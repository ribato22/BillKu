import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  // ======================== SESSIONS ========================

  async openSession(businessId: string, dto: { cashierId: string; cashierName: string; openingCash?: number }) {
    // Check no active session for this cashier
    const active = await this.prisma.pOSSession.findFirst({
      where: { businessId, cashierId: dto.cashierId, closedAt: null },
    });
    if (active) throw new BadRequestException('Cashier already has an active session. Close it first.');

    return this.prisma.pOSSession.create({
      data: {
        businessId,
        cashierId: dto.cashierId,
        cashierName: dto.cashierName,
        openingCash: dto.openingCash ? BigInt(dto.openingCash) : BigInt(0),
      },
    });
  }

  async closeSession(businessId: string, sessionId: string, closingCash?: number) {
    const session = await this.prisma.pOSSession.findFirst({
      where: { id: sessionId, businessId },
      include: { transactions: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.closedAt) throw new BadRequestException('Session already closed');

    const totalSales = session.transactions.reduce((s, t) => s + Number(t.total), 0);
    const totalTx = session.transactions.length;

    const updated = await this.prisma.pOSSession.update({
      where: { id: sessionId },
      data: {
        closedAt: new Date(),
        closingCash: closingCash !== undefined ? BigInt(closingCash) : null,
        totalSales: BigInt(totalSales),
        totalTx,
      },
    });

    return {
      ...updated,
      openingCash: Number(updated.openingCash),
      closingCash: updated.closingCash ? Number(updated.closingCash) : null,
      totalSales: Number(updated.totalSales),
      difference: closingCash !== undefined ? closingCash - (Number(session.openingCash) + totalSales) : null,
    };
  }

  async getActiveSession(businessId: string, cashierId: string) {
    const session = await this.prisma.pOSSession.findFirst({
      where: { businessId, cashierId, closedAt: null },
      include: { transactions: { include: { items: true }, orderBy: { createdAt: 'desc' } } },
    });
    if (!session) throw new NotFoundException('No active session');
    return {
      ...session,
      openingCash: Number(session.openingCash),
      totalSales: Number(session.totalSales),
      transactions: session.transactions.map((t) => ({
        ...t,
        subtotal: Number(t.subtotal),
        taxAmount: Number(t.taxAmount),
        discount: Number(t.discount),
        total: Number(t.total),
        cashReceived: t.cashReceived ? Number(t.cashReceived) : null,
        changeAmount: t.changeAmount ? Number(t.changeAmount) : null,
        items: t.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), discount: Number(i.discount), amount: Number(i.amount) })),
      })),
    };
  }

  async getSessions(businessId: string, query: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await Promise.all([
      this.prisma.pOSSession.findMany({
        where: { businessId },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { transactions: true } } },
      }),
      this.prisma.pOSSession.count({ where: { businessId } }),
    ]);

    return {
      data: data.map((s) => ({
        ...s,
        openingCash: Number(s.openingCash),
        closingCash: s.closingCash ? Number(s.closingCash) : null,
        totalSales: Number(s.totalSales),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ======================== TRANSACTIONS ========================

  async createTransaction(businessId: string, sessionId: string, dto: any) {
    const session = await this.prisma.pOSSession.findFirst({ where: { id: sessionId, businessId, closedAt: null } });
    if (!session) throw new BadRequestException('Session not found or already closed');

    // Generate receipt number
    const now = new Date();
    const prefix = `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.pOSTransaction.count({ where: { businessId, receiptNumber: { startsWith: prefix } } });
    const receiptNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // Calculate items
    const items = (dto.items || []).map((item: any) => {
      const qty = item.qty || 1;
      const unitPrice = BigInt(item.unitPrice || 0);
      const discount = BigInt(item.discount || 0);
      const amount = BigInt(qty) * unitPrice - discount;
      return { productId: item.productId || null, productName: item.productName, qty, unitPrice, discount, amount };
    });

    const subtotal = items.reduce((sum: bigint, i: any) => sum + i.amount, BigInt(0));
    const taxPct = dto.taxPercent || 0;
    const taxAmount = taxPct > 0 ? (subtotal * BigInt(taxPct)) / BigInt(100) : BigInt(0);
    const discountTotal = BigInt(dto.discount || 0);
    const total = subtotal + taxAmount - discountTotal;

    const cashReceived = dto.cashReceived ? BigInt(dto.cashReceived) : null;
    const changeAmount = cashReceived ? cashReceived - total : null;

    const tx = await this.prisma.pOSTransaction.create({
      data: {
        businessId,
        sessionId,
        receiptNumber,
        customerName: dto.customerName || null,
        paymentMethod: dto.paymentMethod || 'cash',
        subtotal,
        taxAmount,
        discount: discountTotal,
        total,
        cashReceived,
        changeAmount,
        items: { create: items },
      },
      include: { items: true },
    });

    // Auto-deduct stock
    for (const item of items) {
      if (item.productId) {
        await this.prisma.product.updateMany({
          where: { id: item.productId, businessId, trackStock: true },
          data: { currentStock: { decrement: item.qty } },
        });
      }
    }

    return {
      ...tx,
      subtotal: Number(tx.subtotal),
      taxAmount: Number(tx.taxAmount),
      discount: Number(tx.discount),
      total: Number(tx.total),
      cashReceived: tx.cashReceived ? Number(tx.cashReceived) : null,
      changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
      items: tx.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        amount: Number(i.amount),
      })),
    };
  }

  async getTransactions(businessId: string, sessionId: string) {
    const txs = await this.prisma.pOSTransaction.findMany({
      where: { businessId, sessionId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return txs.map((tx) => ({
      ...tx,
      subtotal: Number(tx.subtotal),
      taxAmount: Number(tx.taxAmount),
      discount: Number(tx.discount),
      total: Number(tx.total),
      cashReceived: tx.cashReceived ? Number(tx.cashReceived) : null,
      changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
      items: tx.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), discount: Number(i.discount), amount: Number(i.amount) })),
    }));
  }

  async searchProducts(businessId: string, q: string) {
    return this.prisma.product.findMany({
      where: {
        businessId,
        name: { contains: q },
      },
      take: 20,
    });
  }
}
