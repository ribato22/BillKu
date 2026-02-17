import Dexie, { type EntityTable } from "dexie";

// Customer interface matching backend schema
export interface Customer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending" | "conflict";
}

// Product interface matching backend schema
export interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  unit: string;
  sku?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending" | "conflict";
}

// Invoice interface matching backend schema
export interface Invoice {
  id?: string;
  invoiceNumber: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  items: InvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface InvoiceItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Payment interface
export interface Payment {
  id?: string;
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "transfer" | "qris" | "other";
  notes?: string;
  createdAt: Date;
  syncStatus: "synced" | "pending" | "conflict";
}

// Sync queue for offline operations
export interface SyncQueue {
  id?: number;
  entityType: "customer" | "product" | "invoice" | "payment";
  entityId: string;
  operation: "create" | "update" | "delete";
  data: unknown;
  createdAt: Date;
  attempts: number;
  lastError?: string;
}

// ID mapping for local→backend ID resolution
export interface IdMapping {
  id?: number;
  entityType: "customer" | "product" | "invoice" | "payment";
  localId: string;
  backendId: string;
  createdAt: Date;
}

// Define the database
class BillKuDB extends Dexie {
  customers!: EntityTable<Customer, "id">;
  products!: EntityTable<Product, "id">;
  invoices!: EntityTable<Invoice, "id">;
  payments!: EntityTable<Payment, "id">;
  syncQueue!: EntityTable<SyncQueue, "id">;
  idMappings!: EntityTable<IdMapping, "id">;

  constructor() {
    super("BillKuDB");

    // Version 1 - Initial schema (auto-increment IDs)
    this.version(1).stores({
      customers: "++id, name, email, phone, syncStatus, updatedAt",
      products: "++id, name, sku, isActive, syncStatus, updatedAt",
      invoices:
        "++id, invoiceNumber, customerId, status, dueDate, syncStatus, updatedAt",
      payments: "++id, invoiceId, paymentDate, syncStatus",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
    });

    // Version 2 - Use string UUIDs as primary key
    this.version(2).stores({
      customers: "id, name, email, phone, syncStatus, updatedAt",
      products: "id, name, sku, isActive, syncStatus, updatedAt",
      invoices:
        "id, invoiceNumber, customerId, status, dueDate, syncStatus, updatedAt",
      payments: "id, invoiceId, paymentDate, syncStatus",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
    });

    // Version 3 - Add issueDate index to invoices
    this.version(3).stores({
      customers: "id, name, email, phone, syncStatus, updatedAt",
      products: "id, name, sku, isActive, syncStatus, updatedAt",
      invoices:
        "id, invoiceNumber, customerId, issueDate, status, dueDate, syncStatus, updatedAt",
      payments: "id, invoiceId, paymentDate, syncStatus",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
    });

    // Version 4 - Add idMappings for local→backend ID resolution
    this.version(4).stores({
      customers: "id, name, email, phone, syncStatus, updatedAt",
      products: "id, name, sku, isActive, syncStatus, updatedAt",
      invoices:
        "id, invoiceNumber, customerId, issueDate, status, dueDate, syncStatus, updatedAt",
      payments: "id, invoiceId, paymentDate, syncStatus",
      syncQueue: "++id, entityType, entityId, operation, createdAt",
      idMappings: "++id, [entityType+localId], [entityType+backendId], createdAt",
    });
  }
}

// Export singleton instance
export const db = new BillKuDB();

// Helper to generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}
