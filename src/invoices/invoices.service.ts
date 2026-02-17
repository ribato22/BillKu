import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceNumberingService } from '../invoice-numbering/invoice-numbering.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { nanoid } from 'nanoid';
import { InvoiceStatus, DiscountType, Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private invoiceNumbering: InvoiceNumberingService,
  ) {}

  /**
   * List invoices with pagination and filters
   */
  async findAll(
    businessId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: string | string[];
      customerId?: string;
    } = {},
  ) {
    const { page = 1, pageSize = 20, status, customerId } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.InvoiceWhereInput = {
      businessId,
      ...(status
        ? Array.isArray(status)
          ? { status: { in: status as InvoiceStatus[] } }
          : { status: status as InvoiceStatus }
        : {}),
      ...(customerId ? { customerId } : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          currency: { select: { code: true, symbol: true } },
          _count: { select: { items: true, payments: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((inv) => this.serializeInvoice(inv)),
      meta: { page, pageSize, total },
    };
  }

  /**
   * Get invoice by ID with full details
   */
  async findOne(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        business: {
          select: {
            name: true,
            address: true,
            logoUrl: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
          },
        },
        customer: true,
        currency: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.serializeInvoice(invoice);
  }

  /**
   * Get invoice by ID with business info for export (PDF/CSV)
   */
  async findOneForExport(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        business: true,
        customer: true,
        currency: true,
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  /**
   * Get invoice by public ID (for public links)
   */
  async findByPublicId(publicId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicId },
      include: {
        business: {
          select: {
            name: true,
            address: true,
            logoUrl: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
          },
        },
        customer: true,
        currency: true,
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.serializeInvoice(invoice);
  }

  /**
   * Create a new invoice
   */
  async create(businessId: string, data: CreateInvoiceDto) {
    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId, deletedAt: null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    // Get or default currency
    const currencyCode = data.currencyCode || 'IDR';
    const currency = await this.prisma.currency.findUnique({
      where: { code: currencyCode },
    });
    if (!currency) {
      throw new BadRequestException(`Currency ${currencyCode} not found`);
    }

    // Generate invoice number
    const invoiceNumber = await this.invoiceNumbering.generateNextNumber(
      businessId,
      new Date(data.issueDate),
    );

    // Calculate totals
    const { subtotal, discountAmount, taxAmount, total } = this.calculateTotals(
      data.items,
      data.taxEnabled || false,
      data.taxRateBps || 1100,
      data.discountType as DiscountType | undefined,
      data.discountValue || 0,
    );

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: data.customerId,
        invoiceNumber,
        publicId: nanoid(12),
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        status: 'draft',
        currencyCode,
        currencyMinorUnit: currency.minorUnit,
        taxEnabled: data.taxEnabled || false,
        taxRateBps: data.taxRateBps || 1100,
        subtotal: BigInt(subtotal),
        discountType: data.discountType as DiscountType || null,
        discountValue: data.discountValue || 0,
        discountAmount: BigInt(discountAmount),
        taxAmount: BigInt(taxAmount),
        total: BigInt(total),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId || null,
            description: item.description,
            qty: item.qty,
            unitPrice: BigInt(item.unitPrice),
            total: BigInt(Math.round(item.qty * item.unitPrice)),
          })),
        },
      },
      include: {
        customer: true,
        currency: true,
        items: true,
      },
    });

    return this.serializeInvoice(invoice);
  }

  /**
   * Update an invoice (only draft status)
   */
  async update(businessId: string, id: string, data: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException('Can only edit draft invoices');
    }

    // If updating customer, verify exists
    if (data.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: data.customerId, businessId, deletedAt: null },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
    }

    // Recalculate totals if items provided
    let totals = {};
    if (data.items) {
      const calculated = this.calculateTotals(
        data.items,
        data.taxEnabled ?? existing.taxEnabled,
        data.taxRateBps ?? existing.taxRateBps,
        (data.discountType as DiscountType) ?? existing.discountType,
        data.discountValue ?? existing.discountValue,
      );
      totals = {
        subtotal: BigInt(calculated.subtotal),
        discountAmount: BigInt(calculated.discountAmount),
        taxAmount: BigInt(calculated.taxAmount),
        total: BigInt(calculated.total),
      };
    }

    // Update invoice
    const invoice = await this.prisma.$transaction(async (tx) => {
      // Delete old items if replacing
      if (data.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          customerId: data.customerId,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          taxEnabled: data.taxEnabled,
          taxRateBps: data.taxRateBps,
          discountType: data.discountType as DiscountType,
          discountValue: data.discountValue,
          ...totals,
          ...(data.items
            ? {
                items: {
                  create: data.items.map((item) => ({
                    productId: item.productId || null,
                    description: item.description,
                    qty: item.qty,
                    unitPrice: BigInt(item.unitPrice),
                    total: BigInt(Math.round(item.qty * item.unitPrice)),
                  })),
                },
              }
            : {}),
        },
        include: {
          customer: true,
          currency: true,
          items: true,
        },
      });
    });

    return this.serializeInvoice(invoice);
  }

  /**
   * Update invoice status
   */
  async updateStatus(businessId: string, id: string, status: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      draft: ['sent', 'paid', 'canceled'],
      sent: ['paid', 'overdue', 'canceled'],
      overdue: ['paid', 'canceled'],
      paid: [],
      canceled: [],
    };

    if (!validTransitions[existing.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${existing.status} to ${status}`,
      );
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: status as InvoiceStatus },
      include: { customer: true, currency: true },
    });

    return this.serializeInvoice(invoice);
  }

  /**
   * Delete invoice (only draft)
   */
  async remove(businessId: string, id: string) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException('Can only delete draft invoices');
    }

    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }

  // === Private Helpers ===

  private calculateTotals(
    items: { qty: number; unitPrice: number }[],
    taxEnabled: boolean,
    taxRateBps: number,
    discountType?: DiscountType | null,
    discountValue?: number,
  ) {
    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(item.qty * item.unitPrice),
      0,
    );

    let discountAmount = 0;
    if (discountType === 'percent' && discountValue) {
      discountAmount = Math.round((subtotal * discountValue) / 100);
    } else if (discountType === 'amount' && discountValue) {
      discountAmount = discountValue;
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = taxEnabled
      ? Math.round((afterDiscount * taxRateBps) / 10000)
      : 0;
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  }

  private serializeInvoice(invoice: any) {
    return {
      ...invoice,
      taxRateBps: Number(invoice.taxRateBps),
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discountAmount),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      items: invoice.items?.map((item: any) => ({
        ...item,
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        product: item.product ? {
          ...item.product,
          price: Number(item.product.price),
        } : undefined,
      })),
      payments: invoice.payments?.map((p: any) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }
}
