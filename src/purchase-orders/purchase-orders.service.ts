import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.purchaseOrder.count({
      where: { businessId, orderNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(businessId: string, query: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: data.map((po) => ({
        ...po,
        subtotal: Number(po.subtotal),
        taxAmount: Number(po.taxAmount),
        total: Number(po.total),
        items: po.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: { include: { product: true } } },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');
    return {
      ...po,
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      total: Number(po.total),
      items: po.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async create(businessId: string, dto: CreatePurchaseOrderDto) {
    const orderNumber = await this.generateNumber(businessId);
    const items = dto.items.map((item) => ({
      ...item,
      unitPrice: BigInt(item.unitPrice),
      amount: BigInt(item.unitPrice * item.qty),
    }));

    const subtotal = items.reduce((sum, it) => sum + it.amount, BigInt(0));

    const po = await this.prisma.purchaseOrder.create({
      data: {
        businessId,
        vendorName: dto.vendorName,
        vendorEmail: dto.vendorEmail,
        vendorPhone: dto.vendorPhone,
        orderNumber,
        orderDate: new Date(dto.orderDate),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        notes: dto.notes,
        subtotal,
        total: subtotal,
        items: { create: items.map(({ unitPrice, amount, ...rest }) => ({ ...rest, unitPrice, amount })) },
      },
      include: { items: true },
    });

    return {
      ...po,
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      total: Number(po.total),
      items: po.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async update(businessId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Purchase Order not found');

    const updateData: any = {};
    if (dto.vendorName) updateData.vendorName = dto.vendorName;
    if (dto.vendorEmail !== undefined) updateData.vendorEmail = dto.vendorEmail;
    if (dto.vendorPhone !== undefined) updateData.vendorPhone = dto.vendorPhone;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status) updateData.status = dto.status;

    if (dto.items) {
      await this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      const items = dto.items.map((item) => ({
        purchaseOrderId: id,
        ...item,
        unitPrice: BigInt(item.unitPrice),
        amount: BigInt(item.unitPrice * item.qty),
      }));
      await this.prisma.purchaseOrderItem.createMany({ data: items });
      const subtotal = items.reduce((sum, it) => sum + it.amount, BigInt(0));
      updateData.subtotal = subtotal;
      updateData.total = subtotal;
    }

    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return {
      ...po,
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      total: Number(po.total),
      items: po.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Purchase Order not found');
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { message: 'Purchase Order deleted' };
  }

  async receiveStock(businessId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status === 'received') throw new BadRequestException('Already received');

    // Auto-adjust stock for tracked products
    for (const item of po.items) {
      if (item.productId) {
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, businessId },
        });
        if (product && product.trackStock) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { currentStock: product.currentStock + item.qty },
          });
        }
      }
    }

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'received' },
    });

    return {
      message: `Purchase Order ${po.orderNumber} received. Stock adjusted for tracked products.`,
    };
  }
}
