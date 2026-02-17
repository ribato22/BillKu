import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryNoteDto } from './dto';

@Injectable()
export class DeliveryNotesService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `SJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const last = await this.prisma.deliveryNote.findFirst({
      where: { businessId, noteNumber: { startsWith: prefix } },
      orderBy: { noteNumber: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.noteNumber.split('-');
      seq = parseInt(parts[2] || '0', 10) + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  async findAll(businessId: string) {
    return this.prisma.deliveryNote.findMany({
      where: { businessId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const note = await this.prisma.deliveryNote.findFirst({
      where: { id, businessId },
      include: {
        invoice: {
          include: { customer: { select: { name: true } } },
        },
        items: true,
      },
    });
    if (!note) throw new NotFoundException('Delivery note not found');
    return note;
  }

  async create(businessId: string, dto: CreateDeliveryNoteDto) {
    const noteNumber = await this.generateNumber(businessId);

    return this.prisma.deliveryNote.create({
      data: {
        businessId,
        invoiceId: dto.invoiceId,
        noteNumber,
        deliveryDate: new Date(dto.deliveryDate),
        recipient: dto.recipient,
        address: dto.address,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            description: item.description,
            qty: item.qty,
            unit: item.unit || 'pcs',
          })),
        },
      },
      include: { items: true },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.deliveryNote.delete({ where: { id } });
  }
}
