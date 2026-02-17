import { db, generateId, type Product } from "./index";

export const productService = {
  // Get all products
  async getAll(): Promise<Product[]> {
    return db.products.orderBy("name").toArray();
  },

  // Get active products only
  async getActive(): Promise<Product[]> {
    return db.products.where("isActive").equals(1).toArray();
  },

  // Get product by ID
  async getById(id: string): Promise<Product | undefined> {
    return db.products.get(id);
  },

  // Search products
  async search(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase();
    return db.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.sku?.toLowerCase().includes(lowerQuery) === true ||
          p.description?.toLowerCase().includes(lowerQuery) === true
      )
      .toArray();
  },

  // Create new product
  async create(
    data: Omit<Product, "id" | "createdAt" | "updatedAt" | "syncStatus">
  ): Promise<Product> {
    const now = new Date();
    const product: Product = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    };

    await db.products.add(product);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "product",
      entityId: product.id!,
      operation: "create",
      data: product,
      createdAt: now,
      attempts: 0,
    });

    return product;
  },

  // Update product
  async update(
    id: string,
    data: Partial<Omit<Product, "id" | "createdAt" | "syncStatus">>
  ): Promise<Product | undefined> {
    const now = new Date();
    const updateData = {
      ...data,
      updatedAt: now,
      syncStatus: "pending" as const,
    };

    await db.products.update(id, updateData);

    // Add to sync queue
    await db.syncQueue.add({
      entityType: "product",
      entityId: id,
      operation: "update",
      data: updateData,
      createdAt: now,
      attempts: 0,
    });

    return db.products.get(id);
  },

  // Delete product (soft delete - set inactive)
  async delete(id: string): Promise<void> {
    await this.update(id, { isActive: false });
  },

  // Hard delete product
  async hardDelete(id: string): Promise<void> {
    await db.syncQueue.add({
      entityType: "product",
      entityId: id,
      operation: "delete",
      data: null,
      createdAt: new Date(),
      attempts: 0,
    });

    await db.products.delete(id);
  },

  // Get products with pending sync status
  async getPendingSync(): Promise<Product[]> {
    return db.products.where("syncStatus").equals("pending").toArray();
  },

  // Mark product as synced
  async markSynced(id: string): Promise<void> {
    await db.products.update(id, { syncStatus: "synced" });
  },

  // Get product count
  async count(): Promise<number> {
    return db.products.count();
  },

  // Format price for display (Indonesian Rupiah)
  formatPrice(price: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  },
};
