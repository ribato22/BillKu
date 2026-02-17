import { db, generateId, type Customer } from "./index";

export const customerService = {
  // Get all customers
  async getAll(): Promise<Customer[]> {
    return db.customers.orderBy("name").toArray();
  },

  // Get customer by ID
  async getById(id: string): Promise<Customer | undefined> {
    return db.customers.get(id);
  },

  // Search customers
  async search(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return db.customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(lowerQuery) ||
          c.email?.toLowerCase().includes(lowerQuery) === true ||
          c.phone?.includes(query) === true
      )
      .toArray();
  },

  // Create new customer
  async create(
    data: Omit<Customer, "id" | "createdAt" | "updatedAt" | "syncStatus">
  ): Promise<Customer> {
    const now = new Date();
    const customer: Customer = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    };

    await db.customers.add(customer);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "customer",
      entityId: customer.id!,
      operation: "create",
      data: customer,
      createdAt: now,
      attempts: 0,
    });

    return customer;
  },

  // Update customer
  async update(
    id: string,
    data: Partial<Omit<Customer, "id" | "createdAt" | "syncStatus">>
  ): Promise<Customer | undefined> {
    const now = new Date();
    const updateData = {
      ...data,
      updatedAt: now,
      syncStatus: "pending" as const,
    };

    await db.customers.update(id, updateData);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "customer",
      entityId: id,
      operation: "update",
      data: updateData,
      createdAt: now,
      attempts: 0,
    });

    return db.customers.get(id);
  },

  // Delete customer
  async delete(id: string): Promise<void> {
    // Add to sync queue before deleting
    await db.syncQueue.add({
      entityType: "customer",
      entityId: id,
      operation: "delete",
      data: null,
      createdAt: new Date(),
      attempts: 0,
    });

    await db.customers.delete(id);
  },

  // Get customers with pending sync status
  async getPendingSync(): Promise<Customer[]> {
    return db.customers.where("syncStatus").equals("pending").toArray();
  },

  // Mark customer as synced
  async markSynced(id: string): Promise<void> {
    await db.customers.update(id, { syncStatus: "synced" });
  },

  // Get customer count
  async count(): Promise<number> {
    return db.customers.count();
  },
};
