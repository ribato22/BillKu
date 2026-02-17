import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List products for a business with pagination
   */
  async findAll(
    businessId: string,
    options: { page?: number; pageSize?: number; search?: string; lowStock?: boolean } = {},
  ) {
    const { page = 1, pageSize = 20, search, lowStock } = options;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { businessId };
    if (search) {
      where.name = { contains: search };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    let result = products.map((p) => ({
      ...p,
      price: Number(p.price),
      isLowStock: p.trackStock && p.lowStockAlert ? p.currentStock <= p.lowStockAlert : false,
    }));

    // Deduplicate by name (DB may have duplicates with different IDs)
    const seenNames = new Set<string>();
    result = result.filter((p) => {
      if (seenNames.has(p.name)) return false;
      seenNames.add(p.name);
      return true;
    });

    // Filter low stock items only
    if (lowStock) {
      result = result.filter((p) => p.isLowStock);
    }

    return {
      data: result,
      meta: { page, pageSize, total },
    };
  }

  /**
   * Get product by ID
   */
  async findOne(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...product,
      price: Number(product.price),
      isLowStock: product.trackStock && product.lowStockAlert
        ? product.currentStock <= product.lowStockAlert
        : false,
    };
  }

  /**
   * Create a new product
   */
  async create(businessId: string, data: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        businessId,
        name: data.name,
        price: BigInt(data.price),
        unit: data.unit || 'pcs',
        trackStock: data.trackStock || false,
        currentStock: data.currentStock || 0,
        lowStockAlert: data.lowStockAlert || null,
      },
    });

    return {
      ...product,
      price: Number(product.price),
    };
  }

  /**
   * Update a product
   */
  async update(businessId: string, id: string, data: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price !== undefined ? BigInt(data.price) : undefined,
        unit: data.unit,
        trackStock: data.trackStock,
        currentStock: data.currentStock,
        lowStockAlert: data.lowStockAlert,
      },
    });

    return {
      ...product,
      price: Number(product.price),
    };
  }

  /**
   * Adjust stock for a product
   */
  async adjustStock(businessId: string, id: string, adjustment: number, reason?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.trackStock) {
      throw new BadRequestException('Stock tracking is not enabled for this product');
    }

    const newStock = product.currentStock + adjustment;
    if (newStock < 0) {
      throw new BadRequestException(`Insufficient stock. Current: ${product.currentStock}, adjustment: ${adjustment}`);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { currentStock: newStock },
    });

    return {
      ...updated,
      price: Number(updated.price),
      previousStock: product.currentStock,
      adjustment,
      reason: reason || null,
    };
  }

  /**
   * Get stock summary (low stock alerts)
   */
  async getStockSummary(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, trackStock: true },
      orderBy: { currentStock: 'asc' },
    });

    const lowStock = products.filter(
      (p) => p.lowStockAlert && p.currentStock <= p.lowStockAlert,
    );

    return {
      totalTracked: products.length,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        lowStockAlert: p.lowStockAlert,
        unit: p.unit,
      })),
    };
  }

  /**
   * Delete a product (hard delete since no deletedAt field)
   */
  async remove(businessId: string, id: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }
}
