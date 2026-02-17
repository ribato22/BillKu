import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard summary
   */
  async getDashboard(businessId: string) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get invoice stats (using valid InvoiceStatus: draft, sent, partial, paid)
    const [
      totalInvoices,
      draftCount,
      sentCount,
      partialCount,
      paidCount,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: { businessId } }),
      this.prisma.invoice.count({ where: { businessId, status: 'draft' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'sent' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'partial' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'paid' } }),
    ]);

    // Count overdue (sent/partial past due date)
    const overdueCount = await this.prisma.invoice.count({
      where: {
        businessId,
        status: { in: ['sent', 'partial'] },
        dueDate: { lt: today },
      },
    });

    // Get revenue stats
    const paidInvoices = await this.prisma.invoice.findMany({
      where: { businessId, status: 'paid' },
      select: { total: true, createdAt: true },
    });

    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );

    const monthlyRevenue = paidInvoices
      .filter((inv) => inv.createdAt >= startOfMonth)
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    // Get outstanding (sent + partial)
    const outstandingInvoices = await this.prisma.invoice.findMany({
      where: { businessId, status: { in: ['sent', 'partial'] } },
      select: { total: true },
    });

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.total),
      0,
    );

    // Customer count
    const customerCount = await this.prisma.customer.count({
      where: { businessId, deletedAt: null },
    });

    return {
      invoices: {
        total: totalInvoices,
        draft: draftCount,
        sent: sentCount,
        partial: partialCount,
        paid: paidCount,
        overdue: overdueCount, // calculated based on due date
      },
      revenue: {
        total: totalRevenue,
        thisMonth: monthlyRevenue,
        outstanding: totalOutstanding,
      },
      customers: {
        total: customerCount,
      },
    };
  }

  /**
   * Get revenue report by period
   */
  async getRevenueReport(
    businessId: string,
    options: { startDate?: string; endDate?: string } = {},
  ) {
    const where: any = { businessId, status: 'paid' };

    if (options.startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(options.startDate) };
    }
    if (options.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(options.endDate) };
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const total = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer,
        total: Number(inv.total),
        paidAt: inv.updatedAt,
      })),
      summary: {
        count: invoices.length,
        total,
      },
    };
  }

  /**
   * Get aging report (outstanding invoices by age)
   */
  async getAgingReport(businessId: string) {
    const today = new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: { businessId, status: { in: ['sent', 'partial'] } },
      include: { customer: { select: { id: true, name: true } } },
    });

    const aging = {
      current: [] as any[],      // not yet due
      days1_30: [] as any[],     // 1-30 days overdue
      days31_60: [] as any[],    // 31-60 days
      days61_90: [] as any[],    // 61-90 days
      over90: [] as any[],       // 90+ days
    };

    invoices.forEach((inv) => {
      const dueDate = new Date(inv.dueDate);
      const daysDiff = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const item = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer,
        dueDate: inv.dueDate,
        total: Number(inv.total),
        daysOverdue: daysDiff > 0 ? daysDiff : 0,
      };

      if (daysDiff <= 0) aging.current.push(item);
      else if (daysDiff <= 30) aging.days1_30.push(item);
      else if (daysDiff <= 60) aging.days31_60.push(item);
      else if (daysDiff <= 90) aging.days61_90.push(item);
      else aging.over90.push(item);
    });

    return {
      aging,
      summary: {
        current: aging.current.reduce((s, i) => s + i.total, 0),
        days1_30: aging.days1_30.reduce((s, i) => s + i.total, 0),
        days31_60: aging.days31_60.reduce((s, i) => s + i.total, 0),
        days61_90: aging.days61_90.reduce((s, i) => s + i.total, 0),
        over90: aging.over90.reduce((s, i) => s + i.total, 0),
      },
    };
  }

  /**
   * Export invoices as CSV data
   */
  async exportInvoicesCSV(
    businessId: string,
    options: { startDate?: string; endDate?: string; status?: string } = {},
  ) {
    const where: any = { businessId };

    if (options.startDate) {
      where.issueDate = { ...where.issueDate, gte: new Date(options.startDate) };
    }
    if (options.endDate) {
      where.issueDate = { ...where.issueDate, lte: new Date(options.endDate) };
    }
    if (options.status) {
      where.status = options.status;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { customer: true },
      orderBy: { issueDate: 'desc' },
    });

    // Generate CSV content
    const headers = [
      'Invoice Number',
      'Customer',
      'Issue Date',
      'Due Date',
      'Status',
      'Subtotal',
      'Tax',
      'Total',
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.customer.name,
      inv.issueDate.toISOString().split('T')[0],
      inv.dueDate.toISOString().split('T')[0],
      inv.status,
      Number(inv.subtotal),
      Number(inv.taxAmount),
      Number(inv.total),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return { csv, count: invoices.length };
  }

  /**
   * Get chart data for dashboard visualization
   */
  async getChartData(businessId: string, months = 6) {
    const today = new Date();

    // Build monthly buckets for the last N months
    const monthlyData: {
      month: string;
      revenue: number;
      invoiceCount: number;
      paidCount: number;
    }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = start.toLocaleDateString('id-ID', {
        month: 'short',
        year: 'numeric',
      });

      const invoices = await this.prisma.invoice.findMany({
        where: {
          businessId,
          issueDate: { gte: start, lte: end },
        },
        select: { total: true, status: true },
      });

      const revenue = invoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      const paidCount = invoices.filter((inv) => inv.status === 'paid').length;

      monthlyData.push({
        month: monthLabel,
        revenue,
        invoiceCount: invoices.length,
        paidCount,
      });
    }

    // Invoice status distribution (all time)
    const [draft, sent, partial, paid] = await Promise.all([
      this.prisma.invoice.count({ where: { businessId, status: 'draft' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'sent' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'partial' } }),
      this.prisma.invoice.count({ where: { businessId, status: 'paid' } }),
    ]);

    // Top 5 debtors (customers with highest outstanding)
    const outstandingInvoices = await this.prisma.invoice.findMany({
      where: { businessId, status: { in: ['sent', 'partial'] } },
      include: { customer: { select: { id: true, name: true } } },
    });

    const debtorMap = new Map<string, { name: string; total: number }>();
    outstandingInvoices.forEach((inv) => {
      const key = inv.customer.id;
      const existing = debtorMap.get(key) || {
        name: inv.customer.name,
        total: 0,
      };
      existing.total += Number(inv.total);
      debtorMap.set(key, existing);
    });

    const topDebtors = Array.from(debtorMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      monthlyRevenue: monthlyData,
      statusDistribution: { draft, sent, partial, paid },
      topDebtors,
    };
  }

  /**
   * Get recent invoices for dashboard
   */
  async getRecentInvoices(businessId: string, limit = 5) {
    const invoices = await this.prisma.invoice.findMany({
      where: { businessId },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer.name,
      total: Number(inv.total),
      status: inv.status,
      dueDate: inv.dueDate,
    }));
  }

  /**
   * Profit & Loss report
   */
  async getProfitLoss(
    businessId: string,
    options: { from?: string; to?: string } = {},
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (options.from) dateFilter.gte = new Date(options.from);
    if (options.to) dateFilter.lte = new Date(options.to);

    // Revenue: sum of paid invoice items
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: 'paid',
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      include: { items: true },
    });

    const revenue = paidInvoices.reduce((sum, inv) => {
      const invoiceTotal = inv.items.reduce(
        (s, item) => s + Number(item.unitPrice) * Number(item.qty),
        0,
      );
      return sum + invoiceTotal;
    }, 0);

    // Expenses by category
    const expenses = await this.prisma.expense.groupBy({
      by: ['categoryType'],
      where: {
        businessId,
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      _sum: { amount: true },
    });

    const totalExpenses = expenses.reduce(
      (sum, e) => sum + (e._sum.amount ? Number(e._sum.amount) : 0),
      0,
    );

    const expenseBreakdown = expenses.map((e) => ({
      category: e.categoryType,
      amount: e._sum.amount ? Number(e._sum.amount) : 0,
    }));

    // Tax: sum of PPN from paid invoices
    const taxCollected = paidInvoices.reduce((sum, inv) => {
      return sum + Number(inv.taxAmount || 0);
    }, 0);

    return {
      revenue,
      totalExpenses,
      netProfit: revenue - totalExpenses,
      expenseBreakdown,
      invoiceCount: paidInvoices.length,
      taxCollected,
      period: {
        from: options.from || null,
        to: options.to || null,
      },
    };
  }

  /**
   * Simplified Balance Sheet for UMKM
   * Includes tax liability calculation based on invoice taxAmount
   */
  async getBalanceSheet(businessId: string) {
    // Assets: outstanding receivables (unpaid invoices)
    const receivables = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: ['sent', 'partial'] },
      },
      include: { items: true },
    });

    const totalReceivables = receivables.reduce((sum: number, inv) => {
      return sum + Number(inv.total);
    }, 0);

    // Tax from outstanding invoices (pajak dari piutang)
    const taxFromReceivables = receivables.reduce((sum: number, inv) => {
      return sum + Number(inv.taxAmount || 0);
    }, 0);

    // Cash received (from paid invoices)
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: 'paid',
      },
      include: { items: true },
    });

    const totalCashReceived = paidInvoices.reduce((sum: number, inv) => {
      return sum + Number(inv.total);
    }, 0);

    // Tax collected from paid invoices (pajak terkumpul - harus disetor)
    const taxCollected = paidInvoices.reduce((sum: number, inv) => {
      return sum + Number(inv.taxAmount || 0);
    }, 0);

    // Total expenses (liabilities equivalent for simplified view)
    const expenses = await this.prisma.expense.findMany({
      where: { businessId },
    });
    const totalExpenses = expenses.reduce(
      (sum: number, e) => sum + Number(e.amount),
      0,
    );

    // Inventory value (stock × price for tracked products)
    const stockProducts = await this.prisma.product.findMany({
      where: { businessId, trackStock: true },
    });
    const inventoryValue = stockProducts.reduce(
      (sum: number, p) => sum + p.currentStock * Number(p.price),
      0,
    );

    const totalAssets = totalCashReceived + totalReceivables + inventoryValue;
    const totalLiabilities = totalExpenses + taxCollected;
    const equity = totalAssets - totalLiabilities;

    return {
      assets: {
        cash: totalCashReceived,
        receivables: totalReceivables,
        inventory: inventoryValue,
        total: totalAssets,
      },
      liabilities: {
        expenses: totalExpenses,
        taxCollected,        // PPN yang sudah dikumpulkan dari invoice lunas
        taxFromReceivables,  // PPN dari piutang yang belum terbayar
        total: totalLiabilities,
      },
      equity,
      tax: {
        collected: taxCollected,           // Pajak sudah terkumpul (dari invoice lunas)
        outstanding: taxFromReceivables,   // Pajak masih dalam piutang
        totalTaxLiability: taxCollected,   // Yang harus disetor ke negara
      },
      invoiceCounts: {
        paid: paidInvoices.length,
        outstanding: receivables.length,
      },
    };
  }

  /**
   * Cash Flow Statement (Direct Method)
   * Tracks actual cash movements: receipts from payments, expenditures from expenses
   */
  async getCashFlowStatement(
    businessId: string,
    options: { from?: string; to?: string } = {},
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (options.from) dateFilter.gte = new Date(options.from);
    if (options.to) dateFilter.lte = new Date(options.to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Operating Activities - Cash Inflows (payments received)
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { businessId },
        ...(hasDateFilter && { date: dateFilter }),
      },
      include: {
        invoice: { select: { invoiceNumber: true, customerId: true, customer: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    const cashInflows = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Group inflows by method
    const inflowByMethod: Record<string, number> = {};
    payments.forEach((p) => {
      inflowByMethod[p.method] = (inflowByMethod[p.method] || 0) + Number(p.amount);
    });

    // Operating Activities - Cash Outflows (expenses)
    const expenses = await this.prisma.expense.findMany({
      where: {
        businessId,
        ...(hasDateFilter && { date: dateFilter }),
      },
      orderBy: { date: 'desc' },
    });

    const cashOutflows = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Group outflows by category
    const outflowByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      outflowByCategory[e.categoryType] = (outflowByCategory[e.categoryType] || 0) + Number(e.amount);
    });

    // Monthly breakdown
    const monthlyMap = new Map<string, { inflow: number; outflow: number }>();
    payments.forEach((p) => {
      const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) || { inflow: 0, outflow: 0 };
      entry.inflow += Number(p.amount);
      monthlyMap.set(key, entry);
    });
    expenses.forEach((e) => {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyMap.get(key) || { inflow: 0, outflow: 0 };
      entry.outflow += Number(e.amount);
      monthlyMap.set(key, entry);
    });

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        inflow: data.inflow,
        outflow: data.outflow,
        netCash: data.inflow - data.outflow,
      }));

    const netCashFlow = cashInflows - cashOutflows;

    return {
      operatingActivities: {
        inflows: {
          total: cashInflows,
          byMethod: inflowByMethod,
          transactionCount: payments.length,
        },
        outflows: {
          total: cashOutflows,
          byCategory: outflowByCategory,
          transactionCount: expenses.length,
        },
        netOperating: netCashFlow,
      },
      netCashFlow,
      monthlyBreakdown,
      period: {
        from: options.from || null,
        to: options.to || null,
      },
    };
  }

  /**
   * General Ledger (Buku Besar)
   * Chronological journal of all financial transactions
   */
  async getGeneralLedger(
    businessId: string,
    options: { from?: string; to?: string; page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 50 } = options;
    const dateFilter: Record<string, unknown> = {};
    if (options.from) dateFilter.gte = new Date(options.from);
    if (options.to) dateFilter.lte = new Date(options.to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Collect all financial transactions
    const entries: Array<{
      date: Date;
      type: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    // 1. Invoices created (Debit: Receivables, Credit: Revenue)
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: { not: 'draft' },
        ...(hasDateFilter && { issueDate: dateFilter }),
      },
      include: { customer: { select: { name: true } } },
    });

    invoices.forEach((inv) => {
      entries.push({
        date: inv.issueDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Invoice ke ${inv.customer.name}`,
        debit: Number(inv.total),
        credit: 0,
      });
    });

    // 2. Payments received (Debit: Cash, Credit: Receivables)
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { businessId },
        ...(hasDateFilter && { date: dateFilter }),
      },
      include: {
        invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
      },
    });

    payments.forEach((p) => {
      entries.push({
        date: p.date,
        type: 'PAYMENT',
        reference: p.invoice.invoiceNumber,
        description: `Pembayaran dari ${p.invoice.customer.name} via ${p.method}`,
        debit: 0,
        credit: Number(p.amount),
      });
    });

    // 3. Expenses recorded (Debit: Expense, Credit: Cash)
    const expenses = await this.prisma.expense.findMany({
      where: {
        businessId,
        ...(hasDateFilter && { date: dateFilter }),
      },
    });

    expenses.forEach((e) => {
      entries.push({
        date: e.date,
        type: 'EXPENSE',
        reference: `EXP-${e.id.slice(-6).toUpperCase()}`,
        description: `${e.categoryType}: ${e.description}`,
        debit: Number(e.amount),
        credit: 0,
      });
    });

    // Sort by date descending
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Running balance
    let runningBalance = 0;
    const sortedAsc = [...entries].reverse();
    sortedAsc.forEach((e) => {
      runningBalance += e.credit - e.debit;
    });

    // Paginate
    const total = entries.length;
    const paginatedEntries = entries.slice((page - 1) * limit, page * limit);

    // Calculate totals
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return {
      entries: paginatedEntries.map((e) => ({
        ...e,
        date: e.date.toISOString(),
      })),
      summary: {
        totalDebit,
        totalCredit,
        balance: totalCredit - totalDebit,
        transactionCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      period: {
        from: options.from || null,
        to: options.to || null,
      },
    };
  }
}
