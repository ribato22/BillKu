import { db, type Customer } from "./index";
import { paymentService } from "./payments";
import { customerService } from "./customers";

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
  invoices: string[]; // invoice IDs
}

export interface CustomerReceivable {
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceCount: number;
  oldestDueDate: Date | null;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  totalOverdue: number;
  totalCurrent: number;
  invoiceCount: number;
  overdueCount: number;
  customerCount: number;
}

export const receivablesService = {
  /**
   * Get overall receivables summary
   */
  async getSummary(): Promise<ReceivablesSummary> {
    const invoices = await db.invoices
      .where("status")
      .anyOf(["draft", "sent"])
      .toArray();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalCurrent = 0;
    let overdueCount = 0;
    const customerIds = new Set<string>();

    for (const invoice of invoices) {
      const remaining = await paymentService.getRemainingBalance(invoice.id!);
      if (remaining <= 0) continue;

      totalOutstanding += remaining;
      customerIds.add(invoice.customerId);

      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        totalOverdue += remaining;
        overdueCount++;
      } else {
        totalCurrent += remaining;
      }
    }

    return {
      totalOutstanding,
      totalOverdue,
      totalCurrent,
      invoiceCount: invoices.length,
      overdueCount,
      customerCount: customerIds.size,
    };
  },

  /**
   * Get aging buckets report
   * Current: Not yet due
   * 1-30: 1-30 days overdue
   * 31-60: 31-60 days overdue
   * 61-90: 61-90 days overdue
   * >90: More than 90 days overdue
   */
  async getAgingBuckets(): Promise<AgingBucket[]> {
    const invoices = await db.invoices
      .where("status")
      .anyOf(["draft", "sent"])
      .toArray();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: AgingBucket[] = [
      { label: "Belum Jatuh Tempo", count: 0, amount: 0, invoices: [] },
      { label: "1-30 Hari", count: 0, amount: 0, invoices: [] },
      { label: "31-60 Hari", count: 0, amount: 0, invoices: [] },
      { label: "61-90 Hari", count: 0, amount: 0, invoices: [] },
      { label: "> 90 Hari", count: 0, amount: 0, invoices: [] },
    ];

    for (const invoice of invoices) {
      const remaining = await paymentService.getRemainingBalance(invoice.id!);
      if (remaining <= 0) continue;

      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let bucketIndex: number;
      if (diffDays <= 0) {
        bucketIndex = 0; // Current (not yet due)
      } else if (diffDays <= 30) {
        bucketIndex = 1; // 1-30 days
      } else if (diffDays <= 60) {
        bucketIndex = 2; // 31-60 days
      } else if (diffDays <= 90) {
        bucketIndex = 3; // 61-90 days
      } else {
        bucketIndex = 4; // > 90 days
      }

      buckets[bucketIndex].count++;
      buckets[bucketIndex].amount += remaining;
      buckets[bucketIndex].invoices.push(invoice.id!);
    }

    return buckets;
  },

  /**
   * Get receivables breakdown by customer
   */
  async getByCustomer(): Promise<CustomerReceivable[]> {
    const invoices = await db.invoices
      .where("status")
      .anyOf(["draft", "sent"])
      .toArray();

    const customers = await customerService.getAll();
    const customerMap = new Map<string, Customer>();
    customers.forEach((c) => customerMap.set(c.id!, c));

    const customerData = new Map<
      string,
      {
        totalAmount: number;
        paidAmount: number;
        remainingAmount: number;
        invoiceCount: number;
        oldestDueDate: Date | null;
      }
    >();

    for (const invoice of invoices) {
      const remaining = await paymentService.getRemainingBalance(invoice.id!);
      const paid = await paymentService.getTotalPaidForInvoice(invoice.id!);

      const existing = customerData.get(invoice.customerId) || {
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        invoiceCount: 0,
        oldestDueDate: null,
      };

      existing.totalAmount += invoice.total;
      existing.paidAmount += paid;
      existing.remainingAmount += remaining;
      existing.invoiceCount++;

      const dueDate = new Date(invoice.dueDate);
      if (!existing.oldestDueDate || dueDate < existing.oldestDueDate) {
        existing.oldestDueDate = dueDate;
      }

      customerData.set(invoice.customerId, existing);
    }

    const result: CustomerReceivable[] = [];
    for (const [customerId, data] of customerData) {
      if (data.remainingAmount <= 0) continue;

      const customer = customerMap.get(customerId);
      result.push({
        customerId,
        customerName: customer?.name || "Pelanggan Tidak Dikenal",
        ...data,
      });
    }

    // Sort by remaining amount descending
    result.sort((a, b) => b.remainingAmount - a.remainingAmount);

    return result;
  },

  /**
   * Get top debtors (customers with highest outstanding amounts)
   */
  async getTopDebtors(limit: number = 5): Promise<CustomerReceivable[]> {
    const all = await this.getByCustomer();
    return all.slice(0, limit);
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  /**
   * Format percentage
   */
  formatPercent(value: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  },
};
