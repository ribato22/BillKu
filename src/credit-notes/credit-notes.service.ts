import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditNoteDto, UpdateCreditNoteDto } from './dto';

@Injectable()
export class CreditNotesService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.creditNote.count({
      where: { businessId, creditNoteNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(businessId: string, query: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, invoice: { select: { id: true, invoiceNumber: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return {
      data: data.map((cn) => ({
        ...cn,
        subtotal: Number(cn.subtotal),
        taxAmount: Number(cn.taxAmount),
        total: Number(cn.total),
        appliedAmount: Number(cn.appliedAmount),
        items: cn.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id, businessId },
      include: { customer: true, invoice: true, items: { include: { product: true } } },
    });
    if (!cn) throw new NotFoundException('Credit Note not found');
    return {
      ...cn,
      subtotal: Number(cn.subtotal),
      taxAmount: Number(cn.taxAmount),
      total: Number(cn.total),
      appliedAmount: Number(cn.appliedAmount),
      items: cn.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async create(businessId: string, dto: CreateCreditNoteDto) {
    const creditNoteNumber = await this.generateNumber(businessId);
    const items = dto.items.map((item) => ({
      ...item,
      unitPrice: BigInt(item.unitPrice),
      amount: BigInt(item.unitPrice * item.qty),
    }));

    const subtotal = items.reduce((sum, it) => sum + it.amount, BigInt(0));

    const cn = await this.prisma.creditNote.create({
      data: {
        businessId,
        customerId: dto.customerId,
        invoiceId: dto.invoiceId || null,
        creditNoteNumber,
        issueDate: new Date(dto.issueDate),
        reason: dto.reason,
        notes: dto.notes,
        subtotal,
        total: subtotal,
        items: { create: items.map(({ unitPrice, amount, ...rest }) => ({ ...rest, unitPrice, amount })) },
      },
      include: { customer: true, items: true },
    });

    return {
      ...cn,
      subtotal: Number(cn.subtotal),
      taxAmount: Number(cn.taxAmount),
      total: Number(cn.total),
      appliedAmount: Number(cn.appliedAmount),
      items: cn.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async update(businessId: string, id: string, dto: UpdateCreditNoteDto) {
    const existing = await this.prisma.creditNote.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Credit Note not found');

    const cn = await this.prisma.creditNote.update({
      where: { id },
      data: {
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status as any }),
      },
      include: { customer: true, items: true },
    });

    return {
      ...cn,
      subtotal: Number(cn.subtotal),
      taxAmount: Number(cn.taxAmount),
      total: Number(cn.total),
      appliedAmount: Number(cn.appliedAmount),
      items: cn.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
    };
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.creditNote.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Credit Note not found');
    if (existing.status === 'applied') throw new BadRequestException('Cannot delete applied credit note');
    await this.prisma.creditNote.delete({ where: { id } });
    return { message: 'Credit Note deleted' };
  }

  async applyToInvoice(businessId: string, id: string, invoiceId: string) {
    const cn = await this.prisma.creditNote.findFirst({ where: { id, businessId } });
    if (!cn) throw new NotFoundException('Credit Note not found');
    if (cn.status === 'applied') throw new BadRequestException('Already applied');

    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Apply the credit note amount (adjust concept — for simplified UMKM use)
    await this.prisma.creditNote.update({
      where: { id },
      data: { status: 'applied', invoiceId, appliedAmount: cn.total },
    });

    return {
      message: `Credit Note ${cn.creditNoteNumber} applied to Invoice ${invoice.invoiceNumber}`,
      creditNoteId: cn.id,
      invoiceId: invoice.id,
      appliedAmount: Number(cn.total),
    };
  }
}
