import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { UpdateInvoiceNumberingDto, PreviewInvoiceNumberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvoiceNumberingController {
  constructor(
    private readonly invoiceNumberingService: InvoiceNumberingService,
  ) {}

  /**
   * GET /settings/invoice-numbering
   * Get current invoice numbering rule
   */
  @Get('settings/invoice-numbering')
  async getInvoiceNumbering(@CurrentUser() user: CurrentUserData) {
    const rule = await this.invoiceNumberingService.getRule(user.businessId);

    if (!rule) {
      // Return default settings
      const preview = this.invoiceNumberingService.previewNumber(
        'INV-{YYYY}{MM}-{SEQ:4}',
        'monthly',
        new Date(),
        1,
      );

      return {
        data: {
          pattern: 'INV-{YYYY}{MM}-{SEQ:4}',
          resetPeriod: 'monthly',
          nextNumberPreview: preview.value ?? null,
        },
      };
    }

    // Get preview for current rule
    const preview = await this.invoiceNumberingService.previewNextNumber(
      user.businessId,
    );

    return {
      data: {
        pattern: rule.pattern,
        resetPeriod: rule.resetPeriod,
        nextNumberPreview: preview.ok ? preview.value : null,
      },
    };
  }

  /**
   * PUT /settings/invoice-numbering
   * Update invoice numbering rule
   */
  @Put('settings/invoice-numbering')
  async updateInvoiceNumbering(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateInvoiceNumberingDto,
  ) {
    try {
      const rule = await this.invoiceNumberingService.upsertRule(
        user.businessId,
        dto.pattern,
        dto.resetPeriod,
      );

      // Get preview for updated rule
      const preview = await this.invoiceNumberingService.previewNextNumber(
        user.businessId,
      );

      return {
        data: {
          pattern: rule.pattern,
          resetPeriod: rule.resetPeriod,
          nextNumberPreview: preview.ok ? preview.value : null,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update invoice numbering rule');
    }
  }

  /**
   * POST /invoices/preview-number
   * Preview the next invoice number
   */
  @Post('invoices/preview-number')
  @HttpCode(200)
  async previewInvoiceNumber(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: PreviewInvoiceNumberDto,
  ) {
    const preview = await this.invoiceNumberingService.previewNextNumber(
      user.businessId,
      dto.issueDate,
    );

    if (!preview.ok) {
      throw new BadRequestException({
        code: preview.error,
        message: `Cannot preview invoice number: ${preview.error}`,
      });
    }

    return {
      data: {
        nextNumber: preview.value,
      },
    };
  }
}

