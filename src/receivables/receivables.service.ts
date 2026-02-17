import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
  invoiceIds: string[];
}

@Injectable()
export class ReceivablesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get receivables summary for a business
   */
  async getSummary(businessId: string) {
    const now = new Date();

    // Get all unpaid invoices (sent or partial)
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: ['sent', 'partial'] },
      },
      include: { payments: true },
    });

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    for (const invoice of unpaidInvoices) {
      const paid = invoice.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const remaining = Number(invoice.total) - paid;
      totalOutstanding += remaining;

      if (invoice.dueDate < now) {
        totalOverdue += remaining;
        overdueCount++;
      }
    }

    return {
      totalOutstanding,
      totalOverdue,
      invoiceCount: unpaidInvoices.length,
      overdueCount,
      currencyCode: 'IDR', // Default, could be made dynamic
    };
  }

  /**
   * Get aging buckets for receivables
   * Buckets: <7 days, 7-14 days, 15-30 days, >30 days overdue
   */
  async getAging(businessId: string): Promise<{ buckets: AgingBucket[] }> {
    const now = new Date();

    // Get all overdue invoices
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: ['sent', 'partial'] },
        dueDate: { lt: now },
      },
      include: { payments: true },
    });

    const buckets: AgingBucket[] = [
      { label: '< 7 days', count: 0, totalAmount: 0, invoiceIds: [] },
      { label: '7-14 days', count: 0, totalAmount: 0, invoiceIds: [] },
      { label: '15-30 days', count: 0, totalAmount: 0, invoiceIds: [] },
      { label: '> 30 days', count: 0, totalAmount: 0, invoiceIds: [] },
    ];

    for (const invoice of overdueInvoices) {
      const paid = invoice.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const remaining = Number(invoice.total) - paid;
      const daysOverdue = Math.floor(
        (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let bucketIndex: number;
      if (daysOverdue < 7) {
        bucketIndex = 0;
      } else if (daysOverdue <= 14) {
        bucketIndex = 1;
      } else if (daysOverdue <= 30) {
        bucketIndex = 2;
      } else {
        bucketIndex = 3;
      }

      buckets[bucketIndex].count++;
      buckets[bucketIndex].totalAmount += remaining;
      buckets[bucketIndex].invoiceIds.push(invoice.id);
    }

    return { buckets };
  }
}
