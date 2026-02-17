import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  // ======================== DEALS ========================

  async getDeals(businessId: string, query: { stage?: string; page?: number; limit?: number } = {}) {
    const { stage, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (stage) where.stage = stage;

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, _count: { select: { activities: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      data: data.map((d) => ({ ...d, value: Number(d.value) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDealById(businessId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, businessId },
      include: { customer: true, activities: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return { ...deal, value: Number(deal.value) };
  }

  async createDeal(businessId: string, dto: any) {
    const deal = await this.prisma.deal.create({
      data: {
        businessId,
        customerId: dto.customerId,
        title: dto.title,
        value: dto.value ? BigInt(dto.value) : BigInt(0),
        stage: dto.stage || 'lead',
        probability: dto.probability || 0,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        notes: dto.notes,
        assignedTo: dto.assignedTo,
      },
      include: { customer: true },
    });
    return { ...deal, value: Number(deal.value) };
  }

  async updateDeal(businessId: string, id: string, dto: any) {
    const existing = await this.prisma.deal.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Deal not found');

    const data: any = {};
    if (dto.title) data.title = dto.title;
    if (dto.value !== undefined) data.value = BigInt(dto.value);
    if (dto.stage) {
      data.stage = dto.stage;
      if (dto.stage === 'won' || dto.stage === 'lost') data.closedAt = new Date();
    }
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.expectedCloseDate) data.expectedCloseDate = new Date(dto.expectedCloseDate);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;

    const deal = await this.prisma.deal.update({ where: { id }, data, include: { customer: true } });
    return { ...deal, value: Number(deal.value) };
  }

  async deleteDeal(businessId: string, id: string) {
    const existing = await this.prisma.deal.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Deal not found');
    await this.prisma.deal.delete({ where: { id } });
    return { message: 'Deal deleted' };
  }

  async getDealPipeline(businessId: string) {
    const stages = ['lead', 'prospect', 'proposal', 'negotiation', 'won', 'lost'];
    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const deals = await this.prisma.deal.findMany({
          where: { businessId, stage: stage as any },
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { updatedAt: 'desc' },
        });
        const totalValue = deals.reduce((sum, d) => sum + Number(d.value), 0);
        return { stage, count: deals.length, totalValue, deals: deals.map((d) => ({ ...d, value: Number(d.value) })) };
      }),
    );
    return pipeline;
  }

  // ======================== ACTIVITIES ========================

  async getActivities(businessId: string, query: { type?: string; customerId?: string; completed?: string; page?: number; limit?: number } = {}) {
    const { type, customerId, completed, page = 1, limit = 20 } = query;
    const where: any = { businessId };
    if (type) where.type = type;
    if (customerId) where.customerId = customerId;
    if (completed === 'true') where.completed = true;
    if (completed === 'false') where.completed = false;

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createActivity(businessId: string, dto: any) {
    return this.prisma.activity.create({
      data: {
        businessId,
        customerId: dto.customerId || null,
        dealId: dto.dealId || null,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: { customer: { select: { id: true, name: true } }, deal: { select: { id: true, title: true } } },
    });
  }

  async completeActivity(businessId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, businessId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data: { completed: true, completedAt: new Date() } });
  }

  async deleteActivity(businessId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, businessId } });
    if (!activity) throw new NotFoundException('Activity not found');
    await this.prisma.activity.delete({ where: { id } });
    return { message: 'Activity deleted' };
  }

  // ======================== CUSTOMER TAGS ========================

  async getCustomerTags(businessId: string, customerId: string) {
    return this.prisma.customerTag.findMany({ where: { businessId, customerId } });
  }

  async addCustomerTag(businessId: string, customerId: string, tag: string) {
    return this.prisma.customerTag.upsert({
      where: { businessId_customerId_tag: { businessId, customerId, tag } },
      create: { businessId, customerId, tag },
      update: {},
    });
  }

  async removeCustomerTag(businessId: string, customerId: string, tag: string) {
    await this.prisma.customerTag.deleteMany({ where: { businessId, customerId, tag } });
    return { message: `Tag "${tag}" removed` };
  }
}
