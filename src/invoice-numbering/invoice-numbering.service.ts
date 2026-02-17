import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ResetPeriod } from '@prisma/client';

// Constants
const ALLOWED_LITERAL = /^[A-Z0-9\-_/.]*$/;
const MAX_RESULT_LENGTH = 32;
const MAX_SEQUENCE = 99999999;

// Error codes
export const InvoiceNumberingErrors = {
  PATTERN_INVALID_CHARS: 'PATTERN_INVALID_CHARS',
  PATTERN_TOO_LONG: 'PATTERN_TOO_LONG',
  PATTERN_MISSING_SEQ: 'PATTERN_MISSING_SEQ',
  PATTERN_MULTIPLE_SEQ: 'PATTERN_MULTIPLE_SEQ',
  PATTERN_CONFLICT_YEAR: 'PATTERN_CONFLICT_YEAR',
  PATTERN_DATE_WITHOUT_YEAR: 'PATTERN_DATE_WITHOUT_YEAR',
  PATTERN_MONTH_REQUIRED: 'PATTERN_MONTH_REQUIRED',
  PATTERN_YEAR_REQUIRED: 'PATTERN_YEAR_REQUIRED',
  SEQ_PADDING_INVALID: 'SEQ_PADDING_INVALID',
  BIZ_SLUG_EMPTY: 'BIZ_SLUG_EMPTY',
  SEQ_OVERFLOW: 'SEQ_OVERFLOW',
} as const;

export type InvoiceNumberingError =
  (typeof InvoiceNumberingErrors)[keyof typeof InvoiceNumberingErrors];

export interface ValidationResult {
  ok: boolean;
  error?: InvoiceNumberingError;
}

export interface PreviewResult {
  ok: boolean;
  error?: InvoiceNumberingError;
  value?: string;
}

@Injectable()
export class InvoiceNumberingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sanitize business name to a safe slug for use in invoice numbers
   */
  sanitizeBizSlug(name: string | null | undefined): string {
    const source = typeof name === 'string' ? name : '';
    const upper = source.toUpperCase();
    const dashed = upper.replace(/\s+/g, '-');
    const cleaned = dashed.replace(/[^A-Z0-9-]/g, '');
    return cleaned;
  }

  /**
   * Validate an invoice numbering pattern
   */
  validatePattern(
    pattern: string,
    resetPeriod: ResetPeriod,
    bizName?: string,
  ): ValidationResult {
    if (typeof pattern !== 'string' || pattern.length === 0) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_INVALID_CHARS };
    }

    // Check for SEQ token
    const seqMatches = [...pattern.matchAll(/\{SEQ:(\d+)\}/g)];
    if (seqMatches.length === 0) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_MISSING_SEQ };
    }
    if (seqMatches.length > 1) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_MULTIPLE_SEQ };
    }

    // Validate SEQ padding
    const seqPad = Number(seqMatches[0][1]);
    if (!Number.isInteger(seqPad) || seqPad < 2 || seqPad > 8) {
      return { ok: false, error: InvoiceNumberingErrors.SEQ_PADDING_INVALID };
    }

    // Check for date tokens
    const hasYYYY = pattern.includes('{YYYY}');
    const hasYY = pattern.includes('{YY}');
    const hasMM = pattern.includes('{MM}');
    const hasDD = pattern.includes('{DD}');
    const hasBIZ = pattern.includes('{BIZ}');

    // Cannot have both YYYY and YY
    if (hasYYYY && hasYY) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_CONFLICT_YEAR };
    }

    // MM and DD require a year token
    if ((hasMM || hasDD) && !(hasYYYY || hasYY)) {
      return {
        ok: false,
        error: InvoiceNumberingErrors.PATTERN_DATE_WITHOUT_YEAR,
      };
    }

    // Reset period validations
    if (resetPeriod === 'monthly' && !hasMM) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_MONTH_REQUIRED };
    }

    if (resetPeriod === 'yearly' && !(hasYYYY || hasYY)) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_YEAR_REQUIRED };
    }

    // BIZ token requires non-empty business name
    if (hasBIZ) {
      const slug = this.sanitizeBizSlug(bizName);
      if (!slug) {
        return { ok: false, error: InvoiceNumberingErrors.BIZ_SLUG_EMPTY };
      }
    }

    // Check for invalid characters in literal parts
    const stripped = pattern
      .replace(/\{YYYY\}/g, '')
      .replace(/\{YY\}/g, '')
      .replace(/\{MM\}/g, '')
      .replace(/\{DD\}/g, '')
      .replace(/\{BIZ\}/g, '')
      .replace(/\{SEQ:\d+\}/g, '');

    // Check for unknown tokens (leftover braces)
    if (/[{}]/.test(stripped)) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_INVALID_CHARS };
    }

    // Check for invalid literal characters
    if (!ALLOWED_LITERAL.test(stripped)) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_INVALID_CHARS };
    }

    return { ok: true };
  }

  /**
   * Preview the next invoice number without committing
   */
  previewNumber(
    pattern: string,
    resetPeriod: ResetPeriod,
    issueDate: Date | string | undefined,
    sequence: number,
    bizName?: string,
  ): PreviewResult {
    // Validate first
    const validation = this.validatePattern(pattern, resetPeriod, bizName);
    if (!validation.ok) {
      return validation;
    }

    // Validate sequence
    const seq = Number(sequence);
    if (!Number.isInteger(seq) || seq < 0) {
      return { ok: false, error: InvoiceNumberingErrors.SEQ_PADDING_INVALID };
    }

    if (seq > MAX_SEQUENCE) {
      return { ok: false, error: InvoiceNumberingErrors.SEQ_OVERFLOW };
    }

    // Get padding from pattern
    const seqMatch = pattern.match(/\{SEQ:(\d+)\}/);
    const pad = Number(seqMatch![1]);
    const paddedSeq = seq.toString().padStart(pad, '0');

    // Parse date
    const date = issueDate ? new Date(issueDate) : new Date();
    const year = date.getUTCFullYear().toString();
    const year2 = year.slice(-2);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const bizSlug = pattern.includes('{BIZ}')
      ? this.sanitizeBizSlug(bizName)
      : '';

    // Replace tokens
    let result = pattern;
    result = result.replace(/\{YYYY\}/g, year);
    result = result.replace(/\{YY\}/g, year2);
    result = result.replace(/\{MM\}/g, month);
    result = result.replace(/\{DD\}/g, day);
    result = result.replace(/\{BIZ\}/g, bizSlug);
    result = result.replace(/\{SEQ:\d+\}/g, paddedSeq);

    // Check result length
    if (result.length > MAX_RESULT_LENGTH) {
      return { ok: false, error: InvoiceNumberingErrors.PATTERN_TOO_LONG };
    }

    return { ok: true, value: result };
  }

  /**
   * Get the period key for a given date and reset period
   */
  getPeriodKey(date: Date, resetPeriod: ResetPeriod): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    switch (resetPeriod) {
      case 'yearly':
        return `${year}`;
      case 'monthly':
        return `${year}-${month}`;
      case 'none':
      default:
        return 'none';
    }
  }

  /**
   * Get the invoice numbering rule for a business
   */
  async getRule(businessId: string) {
    return this.prisma.invoiceNumberRule.findUnique({
      where: { businessId },
    });
  }

  /**
   * Create or update the invoice numbering rule for a business
   */
  async upsertRule(
    businessId: string,
    pattern: string,
    resetPeriod: ResetPeriod,
    bizName?: string,
  ) {
    // Validate the pattern first
    const validation = this.validatePattern(pattern, resetPeriod, bizName);
    if (!validation.ok) {
      throw new BadRequestException({
        code: validation.error,
        message: `Invalid invoice pattern: ${validation.error}`,
      });
    }

    return this.prisma.invoiceNumberRule.upsert({
      where: { businessId },
      update: {
        pattern,
        resetPeriod,
      },
      create: {
        businessId,
        pattern,
        resetPeriod,
        lastSequence: 0,
        lastPeriodKey: null,
      },
    });
  }

  /**
   * Generate the next invoice number (atomic operation)
   * For SQLite: uses BEGIN IMMEDIATE for transaction lock
   * For PostgreSQL: uses SELECT ... FOR UPDATE
   */
  async generateNextNumber(
    businessId: string,
    issueDate: Date,
    bizName?: string,
  ): Promise<string> {
    // Use transaction for atomic sequence increment
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get or create rule
      let rule = await tx.invoiceNumberRule.findUnique({
        where: { businessId },
      });

      if (!rule) {
        // Create default rule
        rule = await tx.invoiceNumberRule.create({
          data: {
            businessId,
            pattern: 'INV-{YYYY}{MM}-{SEQ:4}',
            resetPeriod: 'monthly',
            lastSequence: 0,
            lastPeriodKey: null,
          },
        });
      }

      // Calculate period key
      const periodKey = this.getPeriodKey(issueDate, rule.resetPeriod);

      // Determine next sequence
      let nextSequence: number;
      if (rule.lastPeriodKey !== periodKey) {
        // New period, reset sequence
        nextSequence = 1;
      } else {
        // Same period, increment
        nextSequence = rule.lastSequence + 1;
      }

      // Generate the number
      const preview = this.previewNumber(
        rule.pattern,
        rule.resetPeriod,
        issueDate,
        nextSequence,
        bizName,
      );

      if (!preview.ok) {
        throw new BadRequestException({
          code: preview.error,
          message: `Failed to generate invoice number: ${preview.error}`,
        });
      }

      // Update the rule with new sequence
      await tx.invoiceNumberRule.update({
        where: { businessId },
        data: {
          lastSequence: nextSequence,
          lastPeriodKey: periodKey,
        },
      });

      return preview.value!;
    });
  }

  /**
   * Preview the next invoice number without committing
   */
  async previewNextNumber(
    businessId: string,
    issueDate?: Date | string,
    bizName?: string,
  ): Promise<PreviewResult> {
    const rule = await this.getRule(businessId);

    if (!rule) {
      // Return preview with default pattern
      const defaultPattern = 'INV-{YYYY}{MM}-{SEQ:4}';
      const defaultResetPeriod: ResetPeriod = 'monthly';
      return this.previewNumber(
        defaultPattern,
        defaultResetPeriod,
        issueDate,
        1,
        bizName,
      );
    }

    const date = issueDate ? new Date(issueDate) : new Date();
    const periodKey = this.getPeriodKey(date, rule.resetPeriod);

    // Determine what sequence would be next
    let nextSequence: number;
    if (rule.lastPeriodKey !== periodKey) {
      nextSequence = 1;
    } else {
      nextSequence = rule.lastSequence + 1;
    }

    return this.previewNumber(
      rule.pattern,
      rule.resetPeriod,
      issueDate,
      nextSequence,
      bizName,
    );
  }
}
