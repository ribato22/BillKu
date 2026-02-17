import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeteraiService {
  constructor(private prisma: PrismaService) {}

  async requestMeterai(businessId: string, dto: { documentType: string; documentId: string }) {
    // Validate document exists
    if (dto.documentType === 'invoice') {
      const inv = await this.prisma.invoice.findFirst({ where: { id: dto.documentId, businessId } });
      if (!inv) throw new NotFoundException('Invoice not found');
      const total = typeof inv.total === 'bigint' ? Number(inv.total) : Number(inv.total || 0);
      if (total < 5_000_000) {
        throw new BadRequestException('e-Meterai only required for documents ≥ Rp 5.000.000');
      }
    }

    // Check if already requested
    const existing = await this.prisma.meteraiRequest.findFirst({
      where: { businessId, documentType: dto.documentType, documentId: dto.documentId, status: { in: ['pending', 'stamped'] } },
    });
    if (existing) throw new BadRequestException('Meterai already requested for this document');

    const serialNumber = `MTR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const request = await this.prisma.meteraiRequest.create({
      data: {
        businessId,
        documentType: dto.documentType,
        documentId: dto.documentId,
        amount: BigInt(10000),
        status: 'stamped',
        serialNumber,
        stampedAt: new Date(),
      },
    });

    return { ...request, amount: Number(request.amount) };
  }

  async getMeteraiHistory(businessId: string, query: { documentType?: string; status?: string; page?: number; limit?: number } = {}) {
    const { documentType, status, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (documentType) where.documentType = documentType;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.meteraiRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.meteraiRequest.count({ where }),
    ]);

    return {
      data: data.map((m) => ({ ...m, amount: Number(m.amount) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMeteraiStats(businessId: string, period?: string) {
    const where: any = { businessId, status: 'stamped' };
    if (period) {
      const [year, month] = period.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.stampedAt = { gte: start, lte: end };
    }

    const requests = await this.prisma.meteraiRequest.findMany({ where });
    const totalStamped = requests.length;
    const totalCost = requests.reduce((s, r) => s + Number(r.amount), 0);

    // Group by document type
    const byType = new Map<string, number>();
    requests.forEach((r) => byType.set(r.documentType, (byType.get(r.documentType) || 0) + 1));

    return {
      totalStamped,
      totalCost,
      byDocumentType: Object.fromEntries(byType),
    };
  }

  async verifyMeterai(businessId: string, serialNumber: string) {
    const request = await this.prisma.meteraiRequest.findFirst({ where: { businessId, serialNumber } });
    if (!request) throw new NotFoundException('Meterai not found');
    return { valid: request.status === 'stamped', ...request, amount: Number(request.amount) };
  }
}
