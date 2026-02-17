import { db, generateId, type Payment } from "./index";
import { invoiceService } from "./invoices";

export const paymentService = {
  // Get all payments
  async getAll(): Promise<Payment[]> {
    return db.payments.orderBy("paymentDate").reverse().toArray();
  },

  // Get payment by ID
  async getById(id: string): Promise<Payment | undefined> {
    return db.payments.get(id);
  },

  // Get payments for an invoice
  async getByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return db.payments
      .where("invoiceId")
      .equals(invoiceId)
      .reverse()
      .sortBy("paymentDate");
  },

  // Get total paid amount for an invoice
  async getTotalPaidForInvoice(invoiceId: string): Promise<number> {
    const payments = await this.getByInvoiceId(invoiceId);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },

  // Get remaining balance for an invoice
  async getRemainingBalance(invoiceId: string): Promise<number> {
    const invoice = await invoiceService.getById(invoiceId);
    if (!invoice) return 0;

    const totalPaid = await this.getTotalPaidForInvoice(invoiceId);
    return Math.max(0, invoice.total - totalPaid);
  },

  // Create new payment
  async create(
    data: Omit<Payment, "id" | "createdAt" | "syncStatus">
  ): Promise<Payment> {
    const now = new Date();

    const payment: Payment = {
      ...data,
      id: generateId(),
      createdAt: now,
      syncStatus: "pending",
    };

    await db.payments.add(payment);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "payment",
      entityId: payment.id!,
      operation: "create",
      data: payment,
      createdAt: now,
      attempts: 0,
    });

    // Check if invoice is fully paid and update status
    await this.updateInvoiceStatus(data.invoiceId);

    return payment;
  },

  // Update invoice status based on payments
  async updateInvoiceStatus(invoiceId: string): Promise<void> {
    const invoice = await invoiceService.getById(invoiceId);
    if (!invoice) return;

    const totalPaid = await this.getTotalPaidForInvoice(invoiceId);

    if (totalPaid >= invoice.total) {
      // Fully paid
      await invoiceService.markPaid(invoiceId);
    } else if (totalPaid > 0 && invoice.status === "paid") {
      // Was marked paid but now has less payments (refund scenario)
      await db.invoices.update(invoiceId, {
        status: "sent",
        updatedAt: new Date(),
        syncStatus: "pending",
      });
    }
  },

  // Delete payment
  async delete(id: string): Promise<void> {
    const payment = await db.payments.get(id);
    if (!payment) return;

    const invoiceId = payment.invoiceId;

    await db.syncQueue.add({
      entityType: "payment",
      entityId: id,
      operation: "delete",
      data: null,
      createdAt: new Date(),
      attempts: 0,
    });

    await db.payments.delete(id);

    // Update invoice status after deletion
    await this.updateInvoiceStatus(invoiceId);
  },

  // Get recent payments
  async getRecent(limit: number = 10): Promise<Payment[]> {
    return db.payments.orderBy("paymentDate").reverse().limit(limit).toArray();
  },

  // Get statistics
  async getStats(): Promise<{
    total: number;
    totalAmount: number;
    thisMonth: number;
    thisMonthAmount: number;
  }> {
    const payments = await this.getAll();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthPayments = payments.filter(
      (p) => new Date(p.paymentDate) >= startOfMonth
    );

    return {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      thisMonth: thisMonthPayments.length,
      thisMonthAmount: thisMonthPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  },

  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  },

  // Format date
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  },

  // Get payment method label
  getMethodLabel(method: Payment["paymentMethod"]): string {
    switch (method) {
      case "cash":
        return "Tunai";
      case "transfer":
        return "Transfer Bank";
      case "qris":
        return "QRIS";
      case "other":
        return "Lainnya";
      default:
        return method;
    }
  },
};
