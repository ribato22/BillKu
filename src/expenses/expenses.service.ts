import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    businessId: string,
    params?: {
      categoryType?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (params?.categoryType) where.categoryType = params.categoryType;
    if (params?.from || params?.to) {
      where.date = {};
      if (params?.from) (where.date as Record<string, unknown>).gte = new Date(params.from);
      if (params?.to) (where.date as Record<string, unknown>).lte = new Date(params.to);
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async create(businessId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        businessId,
        categoryType: dto.categoryType as 'operational' | 'material' | 'salary' | 'utilities' | 'marketing' | 'other',
        description: dto.description,
        amount: BigInt(dto.amount),
        date: new Date(dto.date),
        vendorName: dto.vendorName,
        receiptUrl: dto.receiptUrl,
        notes: dto.notes,
        currencyCode: dto.currencyCode || 'IDR',
      },
    });
  }

  async update(businessId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(businessId, id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryType && { categoryType: dto.categoryType as 'operational' | 'material' | 'salary' | 'utilities' | 'marketing' | 'other' }),
        ...(dto.description && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: BigInt(dto.amount) }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.vendorName !== undefined && { vendorName: dto.vendorName }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.expense.delete({ where: { id } });
  }

  /**
   * Get summary by category for a date range
   */
  async getSummary(businessId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { businessId };
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const expenses = await this.prisma.expense.groupBy({
      by: ['categoryType'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const total = expenses.reduce(
      (sum, e) => sum + (e._sum.amount ? Number(e._sum.amount) : 0),
      0,
    );

    return {
      categories: expenses.map((e) => ({
        category: e.categoryType,
        total: e._sum.amount ? Number(e._sum.amount) : 0,
        count: e._count,
      })),
      grandTotal: total,
    };
  }
}
