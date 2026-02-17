import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderType } from '@prisma/client';

@Injectable()
export class RemindersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get reminder templates for a business
   */
  async getTemplates(businessId: string) {
    return this.prisma.reminderTemplate.findMany({
      where: { businessId },
      orderBy: { type: 'asc' },
    });
  }

  /**
   * Update or create a reminder template
   */
  async upsertTemplate(
    businessId: string,
    type: ReminderType,
    data: { template: string },
  ) {
    return this.prisma.reminderTemplate.upsert({
      where: {
        businessId_type: { businessId, type },
      },
      create: {
        businessId,
        type,
        template: data.template,
      },
      update: {
        template: data.template,
      },
    });
  }

  /**
   * Get invoices due for reminder (for cron job)
   * H_MINUS_3: invoices due in 3 days
   * OVERDUE: invoices past due date
   */
  async getInvoicesDueForReminder(businessId: string) {
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const templates = await this.prisma.reminderTemplate.findMany({
      where: { businessId },
    });

    const invoices: any[] = [];

    // H_MINUS_3: Due in 3 days
    const hMinus3Template = templates.find((t) => t.type === 'H_MINUS_3');
    if (hMinus3Template) {
      const dueSoon = await this.prisma.invoice.findMany({
        where: {
          businessId,
          status: 'sent',
          dueDate: {
            gte: today,
            lte: threeDaysFromNow,
          },
        },
        include: { customer: true },
      });

      invoices.push(
        ...dueSoon.map((inv) => ({
          ...inv,
          total: Number(inv.total),
          reminderType: 'H_MINUS_3',
          template: hMinus3Template.template,
        })),
      );
    }

    // OVERDUE: Past due date
    const overdueTemplate = templates.find((t) => t.type === 'OVERDUE');
    if (overdueTemplate) {
      const overdue = await this.prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: ['sent', 'partial'] },
          dueDate: { lt: today },
        },
        include: { customer: true },
      });

      invoices.push(
        ...overdue.map((inv) => ({
          ...inv,
          total: Number(inv.total),
          reminderType: 'OVERDUE',
          template: overdueTemplate.template,
        })),
      );
    }

    return invoices;
  }
}
