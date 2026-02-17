import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringFrequency } from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class RecurringService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  /**
   * List recurring invoice templates for a business
   */
  async list(businessId: string) {
    const results = await this.prisma.recurringInvoice.findMany({
      where: { businessId },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return results.map((r) => this.serializeRecurring(r));
  }

  /**
   * Get a single recurring invoice
   */
  async findOne(id: string, businessId: string) {
    const recurring = await this.prisma.recurringInvoice.findFirst({
      where: { id, businessId },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    if (!recurring) throw new NotFoundException('Recurring invoice tidak ditemukan');
    return this.serializeRecurring(recurring);
  }

  /**
   * Create a recurring invoice template
   */
  async create(
    businessId: string,
    data: {
      customerId: string;
      frequency: RecurringFrequency;
      nextDueDate: string;
      dueDayOffset?: number;
      currencyCode?: string;
      taxEnabled?: boolean;
      taxRateBps?: number;
      items: {
        productId?: string;
        description: string;
        qty?: number;
        unitPrice: number;
      }[];
    },
  ) {
    const result = await this.prisma.recurringInvoice.create({
      data: {
        businessId,
        customerId: data.customerId,
        frequency: data.frequency,
        nextDueDate: new Date(data.nextDueDate),
        dueDayOffset: data.dueDayOffset ?? 30,
        currencyCode: data.currencyCode ?? 'IDR',
        taxEnabled: data.taxEnabled ?? false,
        taxRateBps: data.taxRateBps ?? 0,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            qty: item.qty ?? 1,
            unitPrice: BigInt(item.unitPrice),
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: true,
      },
    });
    return this.serializeRecurring(result);
  }

  /**
   * Update a recurring invoice template
   */
  async update(
    id: string,
    businessId: string,
    data: {
      frequency?: RecurringFrequency;
      nextDueDate?: string;
      dueDayOffset?: number;
      isActive?: boolean;
      taxEnabled?: boolean;
      taxRateBps?: number;
    },
  ) {
    const updateData: any = {};
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.nextDueDate !== undefined) updateData.nextDueDate = new Date(data.nextDueDate);
    if (data.dueDayOffset !== undefined) updateData.dueDayOffset = data.dueDayOffset;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.taxEnabled !== undefined) updateData.taxEnabled = data.taxEnabled;
    if (data.taxRateBps !== undefined) updateData.taxRateBps = data.taxRateBps;

    const result = await this.prisma.recurringInvoice.update({
      where: { id, businessId },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } },
        items: true,
      },
    });
    return this.serializeRecurring(result);
  }

  /**
   * Delete (deactivate) a recurring invoice
   */
  async delete(id: string, businessId: string) {
    return this.prisma.recurringInvoice.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }

  /**
   * Generate a real invoice from a recurring template
   */
  async generateInvoice(id: string, businessId: string) {
    const recurring = await this.findOne(id, businessId);

    // Build invoice data from template
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + recurring.dueDayOffset);

    const items = recurring.items.map((item: { productId: string | null; description: string; qty: any; unitPrice: bigint }) => ({
      productId: item.productId ?? undefined,
      description: item.description,
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
    }));

    // Use existing invoice creation service
    const invoice = await this.invoicesService.create(businessId, {
      customerId: recurring.customerId,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      currencyCode: recurring.currencyCode,
      taxEnabled: recurring.taxEnabled,
      taxRateBps: recurring.taxRateBps,
      items,
    });

    // Update lastGenerated and advance nextDueDate
    const nextDue = this.advanceDueDate(
      recurring.nextDueDate,
      recurring.frequency,
    );

    await this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        lastGenerated: new Date(),
        nextDueDate: nextDue,
      },
    });

    return invoice;
  }

  /**
   * Process all due recurring invoices (called by cron)
   */
  async processAllDue() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueRecurring = await this.prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
      },
      include: { business: { select: { id: true } } },
    });

    const results = [];
    for (const recurring of dueRecurring) {
      try {
        const invoice = await this.generateInvoice(
          recurring.id,
          recurring.businessId,
        );
        results.push({
          recurringId: recurring.id,
          invoiceId: invoice.id,
          status: 'success',
        });
      } catch (error: any) {
        results.push({
          recurringId: recurring.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Calculate the next due date based on frequency
   */
  private advanceDueDate(current: Date, frequency: RecurringFrequency): Date {
    const next = new Date(current);
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  /**
   * Convert BigInt fields to Number for JSON serialization
   */
  private serializeRecurring(rec: any) {
    return {
      ...rec,
      taxRateBps: Number(rec.taxRateBps),
      items: rec.items?.map((item: any) => ({
        ...item,
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
        product: item.product ? {
          ...item.product,
          price: item.product.price !== undefined ? Number(item.product.price) : undefined,
        } : undefined,
      })),
    };
  }
}
