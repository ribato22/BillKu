import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto';

@Injectable()
export class SalesOrdersService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.salesOrder.count({
      where: { businessId, orderNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(businessId: string, query: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data: data.map((so) => ({
        ...so,
        subtotal: Number(so.subtotal),
        taxAmount: Number(so.taxAmount),
        total: Number(so.total),
        items: so.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id, businessId },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!so) throw new NotFoundException('Sales Order not found');
    return {
      ...so,
      subtotal: Number(so.subtotal),
      taxAmount: Number(so.taxAmount),
      total: Number(so.total),
      items: so.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async create(businessId: string, dto: CreateSalesOrderDto) {
    const orderNumber = await this.generateNumber(businessId);
    const items = dto.items.map((item) => {
      const unitPrice = BigInt(Math.round(Number(item.unitPrice)));
      const qty = Number(item.qty);
      const amount = unitPrice * BigInt(qty);
      return {
        productId: item.productId || null,
        description: item.description,
        qty,
        unitPrice,
        amount,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.amount, BigInt(0));
    const total = subtotal; // Can add tax calculation later

    const so = await this.prisma.salesOrder.create({
      data: {
        businessId,
        customerId: dto.customerId,
        orderNumber,
        orderDate: new Date(dto.orderDate),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        notes: dto.notes,
        currencyCode: dto.currencyCode || 'IDR',
        subtotal,
        total,
        items: { create: items },
      },
      include: { customer: true, items: true },
    });

    return {
      ...so,
      subtotal: Number(so.subtotal),
      taxAmount: Number(so.taxAmount),
      total: Number(so.total),
      items: so.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async update(businessId: string, id: string, dto: UpdateSalesOrderDto) {
    const existing = await this.prisma.salesOrder.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Sales Order not found');

    const updateData: any = {};
    if (dto.customerId) updateData.customerId = dto.customerId;
    if (dto.orderDate) updateData.orderDate = new Date(dto.orderDate);
    if (dto.expectedDate) updateData.expectedDate = new Date(dto.expectedDate);
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status) updateData.status = dto.status;

    if (dto.items) {
      await this.prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
      const items = dto.items.map((item) => ({
        salesOrderId: id,
        ...item,
        unitPrice: BigInt(item.unitPrice),
        amount: BigInt(item.unitPrice * item.qty),
      }));
      await this.prisma.salesOrderItem.createMany({ data: items });
      const subtotal = items.reduce((sum, it) => sum + it.amount, BigInt(0));
      updateData.subtotal = subtotal;
      updateData.total = subtotal;
    }

    const so = await this.prisma.salesOrder.update({
      where: { id },
      data: updateData,
      include: { customer: true, items: true },
    });

    return {
      ...so,
      subtotal: Number(so.subtotal),
      taxAmount: Number(so.taxAmount),
      total: Number(so.total),
      items: so.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.salesOrder.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Sales Order not found');
    await this.prisma.salesOrder.delete({ where: { id } });
    return { message: 'Sales Order deleted' };
  }

  async convertToInvoice(businessId: string, id: string) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!so) throw new NotFoundException('Sales Order not found');
    if (so.convertedInvoiceId) throw new BadRequestException('Already converted to invoice');

    // Generate invoice number
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.invoice.count({
      where: { businessId, invoiceNumber: { startsWith: prefix } },
    });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    const publicId = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: so.customerId,
        invoiceNumber,
        publicId,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
        currencyCode: so.currencyCode,
        currencyMinorUnit: 0,
        subtotal: so.subtotal,
        taxAmount: so.taxAmount,
        total: so.total,
        items: {
          create: so.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            total: item.amount,
          })),
        },
      },
      include: { items: true, customer: true },
    });

    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'fulfilled', convertedInvoiceId: invoice.id },
    });

    return {
      message: `Sales Order ${so.orderNumber} converted to Invoice ${invoiceNumber}`,
      invoiceId: invoice.id,
      invoiceNumber,
    };
  }
}
