import { db, generateId, type Invoice, type InvoiceItem } from "./index";
import { customerService } from "./customers";

export const invoiceService = {
  // Get all invoices
  async getAll(): Promise<Invoice[]> {
    return db.invoices.orderBy("issueDate").reverse().toArray();
  },

  // Get invoices by status
  async getByStatus(status: Invoice["status"]): Promise<Invoice[]> {
    return db.invoices.where("status").equals(status).toArray();
  },

  // Get invoice by ID
  async getById(id: string): Promise<Invoice | undefined> {
    return db.invoices.get(id);
  },

  // Get invoices for a customer
  async getByCustomerId(customerId: string): Promise<Invoice[]> {
    return db.invoices.where("customerId").equals(customerId).toArray();
  },

  // Search invoices
  async search(query: string): Promise<Invoice[]> {
    const lowerQuery = query.toLowerCase();
    return db.invoices
      .filter((inv) => inv.invoiceNumber.toLowerCase().includes(lowerQuery))
      .toArray();
  },

  // Generate next invoice number
  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Count invoices this month
    const prefix = `INV-${year}${month}`;
    const existing = await db.invoices
      .filter((inv) => inv.invoiceNumber.startsWith(prefix))
      .count();

    const sequence = String(existing + 1).padStart(4, "0");
    return `${prefix}-${sequence}`;
  },

  // Create new invoice
  async create(
    data: Omit<
      Invoice,
      | "id"
      | "invoiceNumber"
      | "subtotal"
      | "tax"
      | "total"
      | "createdAt"
      | "updatedAt"
      | "syncStatus"
    > & { taxRate?: number }
  ): Promise<Invoice> {
    const now = new Date();
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = data.taxRate ?? 0; // Default no tax, can be 11 for PPN
    const tax = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + tax;

    const invoice: Invoice = {
      ...data,
      id: generateId(),
      invoiceNumber,
      subtotal,
      tax,
      total,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    };

    await db.invoices.add(invoice);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "invoice",
      entityId: invoice.id!,
      operation: "create",
      data: invoice,
      createdAt: now,
      attempts: 0,
    });

    return invoice;
  },

  // Update invoice
  async update(
    id: string,
    data: Partial<
      Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "syncStatus">
    > & { taxRate?: number }
  ): Promise<Invoice | undefined> {
    const now = new Date();
    const existing = await db.invoices.get(id);
    if (!existing) return undefined;

    // Recalculate if items changed
    let subtotal = existing.subtotal;
    let tax = existing.tax;
    let total = existing.total;

    if (data.items) {
      subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = data.taxRate ?? (existing.tax / existing.subtotal) * 100;
      tax = Math.round(subtotal * (taxRate / 100));
      total = subtotal + tax;
    }

    const updateData = {
      ...data,
      subtotal,
      tax,
      total,
      updatedAt: now,
      syncStatus: "pending" as const,
    };

    await db.invoices.update(id, updateData);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "invoice",
      entityId: id,
      operation: "update",
      data: updateData,
      createdAt: now,
      attempts: 0,
    });

    return db.invoices.get(id);
  },

  // Delete invoice
  async delete(id: string): Promise<void> {
    await db.syncQueue.add({
      entityType: "invoice",
      entityId: id,
      operation: "delete",
      data: null,
      createdAt: new Date(),
      attempts: 0,
    });

    await db.invoices.delete(id);
  },

  // Mark invoice as paid
  async markPaid(id: string): Promise<Invoice | undefined> {
    const now = new Date();
    const existing = await db.invoices.get(id);
    if (!existing) return undefined;

    await db.invoices.update(id, {
      status: "paid",
      updatedAt: now,
      syncStatus: "pending",
    });

    await db.syncQueue.add({
      entityType: "invoice",
      entityId: id,
      operation: "update",
      data: { status: "paid" },
      createdAt: now,
      attempts: 0,
    });

    return db.invoices.get(id);
  },

  // Get overdue invoices
  async getOverdue(): Promise<Invoice[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return db.invoices
      .filter(
        (inv) =>
          inv.status !== "paid" &&
          inv.status !== "cancelled" &&
          new Date(inv.dueDate) < today
      )
      .toArray();
  },

  // Get statistics
  async getStats(): Promise<{
    total: number;
    totalAmount: number;
    paid: number;
    paidAmount: number;
    unpaid: number;
    unpaidAmount: number;
    overdue: number;
    overdueAmount: number;
  }> {
    const invoices = await this.getAll();
    const overdue = await this.getOverdue();

    const paid = invoices.filter((inv) => inv.status === "paid");
    const unpaid = invoices.filter(
      (inv) => inv.status !== "paid" && inv.status !== "cancelled"
    );

    return {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.total, 0),
      paid: paid.length,
      paidAmount: paid.reduce((sum, inv) => sum + inv.total, 0),
      unpaid: unpaid.length,
      unpaidAmount: unpaid.reduce((sum, inv) => sum + inv.total, 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((sum, inv) => sum + inv.total, 0),
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

  // Get status color
  getStatusColor(
    status: Invoice["status"]
  ): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case "paid":
        return "default";
      case "sent":
        return "secondary";
      case "overdue":
        return "destructive";
      default:
        return "outline";
    }
  },

  // Get status label in Indonesian
  getStatusLabel(status: Invoice["status"]): string {
    switch (status) {
      case "draft":
        return "Draft";
      case "sent":
        return "Terkirim";
      case "paid":
        return "Lunas";
      case "overdue":
        return "Jatuh Tempo";
      case "cancelled":
        return "Dibatalkan";
      default:
        return status;
    }
  },
};
