import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  // ======================== CONNECTIONS ========================

  async getConnections(businessId: string) {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: { businessId },
      include: { _count: { select: { orders: true } } },
    });
    return connections;
  }

  async connectPlatform(businessId: string, dto: { platform: string; shopName: string; shopId?: string; accessToken?: string; refreshToken?: string }) {
    const existing = await this.prisma.marketplaceConnection.findFirst({
      where: { businessId, platform: dto.platform as any },
    });
    if (existing) throw new BadRequestException(`Already connected to ${dto.platform}`);

    return this.prisma.marketplaceConnection.create({
      data: {
        businessId,
        platform: dto.platform as any,
        shopName: dto.shopName,
        shopId: dto.shopId,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        tokenExpiry: dto.accessToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      },
    });
  }

  async disconnectPlatform(businessId: string, id: string) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, businessId } });
    if (!conn) throw new NotFoundException('Connection not found');
    await this.prisma.marketplaceConnection.update({ where: { id }, data: { isActive: false, accessToken: null, refreshToken: null } });
    return { message: `Disconnected from ${conn.platform}` };
  }

  async updateTokens(businessId: string, id: string, dto: { accessToken: string; refreshToken?: string; tokenExpiry?: string }) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id, businessId } });
    if (!conn) throw new NotFoundException('Connection not found');
    return this.prisma.marketplaceConnection.update({
      where: { id },
      data: {
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken || conn.refreshToken,
        tokenExpiry: dto.tokenExpiry ? new Date(dto.tokenExpiry) : null,
        isActive: true,
      },
    });
  }

  // ======================== ORDERS ========================

  async syncOrders(businessId: string, connectionId: string, orders: any[]) {
    const conn = await this.prisma.marketplaceConnection.findFirst({ where: { id: connectionId, businessId } });
    if (!conn) throw new NotFoundException('Connection not found');

    const results = [];
    for (const order of orders) {
      const synced = await this.prisma.marketplaceOrder.upsert({
        where: { connectionId_externalOrderId: { connectionId, externalOrderId: String(order.externalOrderId) } },
        create: {
          businessId,
          connectionId,
          platform: conn.platform,
          externalOrderId: String(order.externalOrderId),
          buyerName: order.buyerName,
          buyerPhone: order.buyerPhone,
          shippingAddress: order.shippingAddress,
          status: order.status || 'new_order',
          subtotal: BigInt(order.subtotal || 0),
          shippingCost: BigInt(order.shippingCost || 0),
          total: BigInt(order.total || 0),
        },
        update: {
          status: order.status || undefined,
          buyerName: order.buyerName,
        },
      });
      results.push({ ...synced, subtotal: Number(synced.subtotal), shippingCost: Number(synced.shippingCost), total: Number(synced.total) });
    }

    await this.prisma.marketplaceConnection.update({ where: { id: connectionId }, data: { lastSyncAt: new Date() } });

    return { synced: results.length, orders: results };
  }

  async getOrders(businessId: string, query: { connectionId?: string; platform?: string; status?: string; page?: number; limit?: number } = {}) {
    const { connectionId, platform, status, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (connectionId) where.connectionId = connectionId;
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.marketplaceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { connection: { select: { id: true, platform: true, shopName: true } } },
      }),
      this.prisma.marketplaceOrder.count({ where }),
    ]);

    return {
      data: data.map((o) => ({ ...o, subtotal: Number(o.subtotal), shippingCost: Number(o.shippingCost), total: Number(o.total) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async convertOrderToInvoice(businessId: string, orderId: string) {
    const order = await this.prisma.marketplaceOrder.findFirst({ where: { id: orderId, businessId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.invoiceId) throw new BadRequestException('Order already linked to an invoice');

    // Generate invoice number
    const now = new Date();
    const prefix = `MP-INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.invoice.count({ where: { businessId, invoiceNumber: { startsWith: prefix } } });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    const publicId = `pub_mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Find or create marketplace customer
    let customer = await this.prisma.customer.findFirst({
      where: { businessId, name: `Marketplace - ${order.platform}` },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { businessId, name: `Marketplace - ${order.platform}`, email: `${order.platform}@marketplace.local` },
      });
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: customer.id,
        invoiceNumber,
        publicId,
        status: 'paid',
        issueDate: new Date(),
        dueDate: new Date(),
        currencyCode: 'IDR',
        currencyMinorUnit: 0,
        subtotal: order.subtotal,
        taxAmount: BigInt(0),
        total: order.total,
        items: {
          create: [{
            description: `${order.platform} order #${order.externalOrderId} — ${order.buyerName}`,
            qty: 1,
            unitPrice: order.total,
            total: order.total,
          }],
        },
      },
    });

    await this.prisma.marketplaceOrder.update({ where: { id: orderId }, data: { invoiceId: invoice.id } });

    return { message: `Order converted to Invoice ${invoiceNumber}`, invoiceId: invoice.id, invoiceNumber };
  }

  async getDashboard(businessId: string) {
    const connections = await this.prisma.marketplaceConnection.findMany({ where: { businessId } });
    const totalOrders = await this.prisma.marketplaceOrder.count({ where: { businessId } });
    const pendingOrders = await this.prisma.marketplaceOrder.count({ where: { businessId, status: { in: ['new_order', 'confirmed', 'processing'] } } });

    const revenueData = await this.prisma.marketplaceOrder.findMany({
      where: { businessId, status: { in: ['delivered'] } },
    });
    const totalRevenue = revenueData.reduce((s, o) => s + Number(o.total), 0);

    // Per platform summary
    const platforms = new Map<string, { orders: number; revenue: number }>();
    const allOrders = await this.prisma.marketplaceOrder.findMany({ where: { businessId } });
    allOrders.forEach((o) => {
      const p = platforms.get(o.platform) || { orders: 0, revenue: 0 };
      p.orders++;
      if (o.status === 'delivered') p.revenue += Number(o.total);
      platforms.set(o.platform, p);
    });

    return {
      connectedPlatforms: connections.filter((c) => c.isActive).length,
      totalOrders,
      pendingOrders,
      totalRevenue,
      byPlatform: Object.fromEntries(platforms),
    };
  }
}
