import { db, type SyncQueue } from "./index";

export interface SyncConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

let syncConfig: SyncConfig | null = null;
let isSyncing = false;

export const syncService = {
  /**
   * Configure the sync service with API base URL and auth token provider
   */
  configure(config: SyncConfig): void {
    syncConfig = config;
  },

  /**
   * Check if sync is configured
   */
  isConfigured(): boolean {
    return syncConfig !== null;
  },

  /**
   * Get pending sync queue items
   */
  async getPendingItems(): Promise<SyncQueue[]> {
    return db.syncQueue.orderBy("createdAt").toArray();
  },

  /**
   * Get count of pending sync items
   */
  async getPendingCount(): Promise<number> {
    return db.syncQueue.count();
  },

  /**
   * Process all pending sync items
   * Returns: { success: number, failed: number }
   */
  async processQueue(): Promise<{ success: number; failed: number }> {
    if (!syncConfig) {
      console.warn("Sync service not configured");
      return { success: 0, failed: 0 };
    }

    if (isSyncing) {
      console.log("Sync already in progress");
      return { success: 0, failed: 0 };
    }

    isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      const items = await this.getPendingItems();
      const token = await syncConfig.getAuthToken();

      if (!token) {
        console.warn("No auth token available, skipping sync");
        return { success: 0, failed: items.length };
      }

      for (const item of items) {
        try {
          await this.processSingleItem(item, token);
          // Remove from queue on success
          await db.syncQueue.delete(item.id!);
          // Update entity sync status
          await this.updateEntitySyncStatus(item.entityType, item.entityId, "synced");
          success++;
        } catch (error) {
          console.error(`Sync failed for ${item.entityType}/${item.entityId}:`, error);
          // Increment attempts
          await db.syncQueue.update(item.id!, {
            attempts: (item.attempts || 0) + 1,
            lastError: error instanceof Error ? error.message : "Unknown error",
          });
          failed++;
        }
      }
    } finally {
      isSyncing = false;
    }

    return { success, failed };
  },

  /**
   * Sanitize payload to only include fields accepted by backend API
   */
  sanitizePayload(entityType: string, data: Record<string, unknown>): Record<string, unknown> {
    // Fields to always remove (internal frontend fields)
    const internalFields = ['id', 'createdAt', 'updatedAt', 'syncStatus', 'businessId'];
    
    // Entity-specific allowed fields
    const allowedFields: Record<string, string[]> = {
      customer: ['name', 'email', 'phone', 'address'],
      product: ['name', 'price', 'unit', 'trackStock', 'currentStock', 'lowStockAlert'],
      invoice: ['customerId', 'issueDate', 'dueDate', 'items', 'taxEnabled', 'taxRateBps'],
      payment: ['date', 'amount', 'method', 'note'],
    };

    // Field name mappings: frontend name → backend name
    const fieldMappings: Record<string, Record<string, string>> = {
      payment: {
        paymentDate: 'date',
        paymentMethod: 'method',
        notes: 'note',
      },
    };

    // Helper to check if value is empty (undefined, null, or empty string)
    const isEmpty = (value: unknown): boolean => {
      return value === undefined || value === null || value === '';
    };

    const allowed = allowedFields[entityType];
    if (!allowed) {
      // If no specific config, just remove internal fields
      const sanitized = { ...data };
      internalFields.forEach(field => delete sanitized[field]);
      return sanitized;
    }

    // Only include allowed fields with non-empty values
    // Also apply field name mappings (frontend name → backend name)
    const sanitized: Record<string, unknown> = {};
    const mappings = fieldMappings[entityType] || {};
    // Build reverse mapping: backend name → frontend name
    const reverseMap: Record<string, string> = {};
    for (const [frontendName, backendName] of Object.entries(mappings)) {
      reverseMap[backendName] = frontendName;
    }
    allowed.forEach(backendField => {
      // Check if source data has this field directly (by backend name)
      if (backendField in data && !isEmpty(data[backendField])) {
        sanitized[backendField] = data[backendField];
      }
      // Or check if there's a frontend name that maps to this backend field
      else if (reverseMap[backendField] && reverseMap[backendField] in data && !isEmpty(data[reverseMap[backendField]])) {
        sanitized[backendField] = data[reverseMap[backendField]];
      }
    });
    
    // Special handling for invoice
    if (entityType === 'invoice') {
      // Add issueDate if not present (use today)
      if (!sanitized.issueDate) {
        sanitized.issueDate = new Date().toISOString().split('T')[0];
      }
      
      // Ensure customerId uses backend ID format
      if (data.customerId) {
        sanitized.customerId = data.customerId;
      }
      
      // Sanitize nested items with correct field names for backend
      if (Array.isArray(sanitized.items)) {
        sanitized.items = (sanitized.items as Record<string, unknown>[]).map(item => ({
          productId: item.productId || undefined,
          description: item.productName || item.description || 'Item',
          qty: Number(item.quantity) || Number(item.qty) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        }));
      }
    }

    return sanitized;
  },

  /**
   * Process a single sync queue item
   */
  async processSingleItem(item: SyncQueue, token: string): Promise<void> {
    if (!syncConfig) throw new Error("Sync not configured");

    // Resolve backend ID for this entity
    const resolvedBackendId = await this.resolveBackendId(item.entityType, item.entityId);

    // Smart operation correction: if 'update' but no backend ID exists, change to 'create'
    let operation = item.operation;
    if (operation === 'update') {
      if (!resolvedBackendId) {
        console.log(`No backend ID found for ${item.entityType}/${item.entityId}, switching to create`);
        operation = 'create';
      }
    }

    const method = this.getMethod(operation);
    
    // For invoices, resolve local customer/product IDs to backend IDs
    let sanitizedData = method !== "DELETE" 
      ? this.sanitizePayload(item.entityType, item.data as Record<string, unknown>)
      : undefined;
    
    if (item.entityType === 'invoice' && sanitizedData) {
      sanitizedData = await this.resolveInvoiceIds(sanitizedData);
    }
    
    // For payments, resolve invoiceId and use nested endpoint
    let endpoint: string;
    if (item.entityType === 'payment' && item.data) {
      const paymentData = item.data as { invoiceId?: string };
      if (paymentData.invoiceId) {
        // Resolve local invoiceId to backend invoiceId
        const backendInvoiceId = await this.resolveBackendId('invoice', paymentData.invoiceId);
        if (backendInvoiceId) {
          endpoint = `/invoices/${backendInvoiceId}/payments`;
          if (operation === 'delete') {
            const backendPaymentId = await this.resolveBackendId('payment', item.entityId);
            endpoint = `/invoices/${backendInvoiceId}/payments/${backendPaymentId || item.entityId}`;
          }
          // Update sanitizedData with backend invoiceId
          if (sanitizedData) {
            delete (sanitizedData as Record<string, unknown>).invoiceId; // Backend doesn't need invoiceId in body
          }
        } else {
          throw new Error(`Cannot sync payment: invoice ${paymentData.invoiceId} not synced yet`);
        }
      } else {
        throw new Error('Payment missing invoiceId');
      }
    } else {
      // Use resolved backend ID for update/delete, local ID for create
      const endpointId = (operation === 'update' || operation === 'delete') && resolvedBackendId
        ? resolvedBackendId
        : item.entityId;
      endpoint = this.getEndpoint(item.entityType, endpointId, operation);
    }

    const response = await fetch(`${syncConfig.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: sanitizedData ? JSON.stringify(sanitizedData) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    // On successful create, save ID mapping
    if (item.operation === 'create' && response.status === 201) {
      try {
        const responseData = await response.json();
        if (responseData.id) {
          await this.saveIdMapping(item.entityType, item.entityId, responseData.id);
        }
      } catch {
        // Response might not be JSON, skip mapping
      }
    }
  },
  
  /**
   * Save local→backend ID mapping
   */
  async saveIdMapping(entityType: string, localId: string, backendId: string): Promise<void> {
    await db.idMappings.add({
      entityType: entityType as "customer" | "product" | "invoice" | "payment",
      localId,
      backendId,
      createdAt: new Date(),
    });
  },
  
  /**
   * Resolve local ID to backend ID
   */
  async resolveBackendId(entityType: string, localId: string): Promise<string | null> {
    const mapping = await db.idMappings
      .where('[entityType+localId]')
      .equals([entityType, localId])
      .first();
    return mapping?.backendId || null;
  },
  
  /**
   * Resolve local IDs in invoice payload to backend IDs
   */
  async resolveInvoiceIds(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolved = { ...data };
    
    // Resolve customerId
    if (resolved.customerId && typeof resolved.customerId === 'string') {
      const backendCustomerId = await this.resolveBackendId('customer', resolved.customerId);
      if (backendCustomerId) {
        resolved.customerId = backendCustomerId;
      }
    }
    
    // Resolve productIds in items
    if (Array.isArray(resolved.items)) {
      resolved.items = await Promise.all(
        (resolved.items as Record<string, unknown>[]).map(async (item) => {
          if (item.productId && typeof item.productId === 'string') {
            const backendProductId = await this.resolveBackendId('product', item.productId);
            return { ...item, productId: backendProductId || item.productId };
          }
          return item;
        })
      );
    }
    
    return resolved;
  },

  /**
   * Get API endpoint for entity type
   */
  getEndpoint(entityType: string, entityId: string, operation: string): string {
    const baseEndpoints: Record<string, string> = {
      customer: "/customers",
      product: "/products",
      invoice: "/invoices",
      payment: "/payments",
    };

    const base = baseEndpoints[entityType] || `/${entityType}s`;

    switch (operation) {
      case "create":
        return base;
      case "update":
      case "delete":
        return `${base}/${entityId}`;
      default:
        return base;
    }
  },

  /**
   * Get HTTP method for operation
   */
  getMethod(operation: string): string {
    switch (operation) {
      case "create":
        return "POST";
      case "update":
        return "PATCH";
      case "delete":
        return "DELETE";
      default:
        return "POST";
    }
  },

  /**
   * Update entity sync status in its respective table
   */
  async updateEntitySyncStatus(
    entityType: string,
    entityId: string,
    status: "pending" | "synced" | "error"
  ): Promise<void> {
    const tables: Record<string, string> = {
      customer: "customers",
      product: "products",
      invoice: "invoices",
      payment: "payments",
    };

    const tableName = tables[entityType];
    if (!tableName) return;

    try {
      // @ts-expect-error - Dynamic table access
      await db[tableName].update(entityId, { syncStatus: status });
    } catch (error) {
      console.warn(`Failed to update sync status for ${entityType}/${entityId}:`, error);
    }
  },

  /**
   * Clear all sync queue items (for testing/debugging)
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
  },

  /**
   * Retry failed sync items (those with attempts > 0)
   */
  async retryFailed(): Promise<{ success: number; failed: number }> {
    return this.processQueue();
  },

  /**
   * Get sync status summary
   */
  async getStatus(): Promise<{
    pending: number;
    syncing: boolean;
    configured: boolean;
  }> {
    return {
      pending: await this.getPendingCount(),
      syncing: isSyncing,
      configured: this.isConfigured(),
    };
  },
  
  /**
   * Populate ID mappings for already-synced entities
   * Call this once after enabling ID mapping to migrate existing data
   */
  async populateIdMappings(): Promise<{ customers: number; products: number }> {
    if (!syncConfig) {
      throw new Error("Sync not configured");
    }
    
    const token = await syncConfig.getAuthToken();
    if (!token) {
      throw new Error("No auth token available");
    }
    
    let customersCount = 0;
    let productsCount = 0;
    
    // Fetch customers from backend and match by name
    try {
      const response = await fetch(`${syncConfig.baseUrl}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const backendCustomers = data.data || [];
        const localCustomers = await db.customers.toArray();
        
        // Debug logging
        console.log('Backend customers:', JSON.stringify(backendCustomers.map((c: {id: string, name: string}) => ({ id: c.id, name: c.name }))));
        console.log('Local customers:', JSON.stringify(localCustomers.map(c => ({ id: c.id, name: c.name }))));
        
        for (const local of localCustomers) {
          // Match by name (since we don't have other unique identifiers)
          const backend = backendCustomers.find((b: {name: string}) => b.name === local.name);
          if (backend && local.id) {
            // Check if mapping already exists
            const existing = await db.idMappings
              .where('[entityType+localId]')
              .equals(['customer', local.id])
              .first();
            
            if (!existing) {
              await db.idMappings.add({
                entityType: 'customer',
                localId: local.id,
                backendId: backend.id,
                createdAt: new Date(),
              });
              customersCount++;
              console.log(`Mapped customer: ${local.name} (local: ${local.id} -> backend: ${backend.id})`);
            } else {
              console.log(`Customer mapping exists: ${local.name}`);
              customersCount++; // Include existing in count
            }
          } else if (!backend) {
            console.log(`No backend match for local customer: ${local.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to populate customer ID mappings:', error);
    }
    
    // Fetch products from backend and match by name
    try {
      const response = await fetch(`${syncConfig.baseUrl}/products`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const backendProducts = data.data || [];
        const localProducts = await db.products.toArray();
        
        // Debug logging
        console.log('Backend products:', JSON.stringify(backendProducts.map((p: {id: string, name: string}) => ({ id: p.id, name: p.name }))));
        console.log('Local products:', JSON.stringify(localProducts.map(p => ({ id: p.id, name: p.name }))));
        
        for (const local of localProducts) {
          const backend = backendProducts.find((b: {name: string}) => b.name === local.name);
          if (backend && local.id) {
            const existing = await db.idMappings
              .where('[entityType+localId]')
              .equals(['product', local.id])
              .first();
            
            if (!existing) {
              await db.idMappings.add({
                entityType: 'product',
                localId: local.id,
                backendId: backend.id,
                createdAt: new Date(),
              });
              productsCount++;
              console.log(`Mapped product: ${local.name} (local: ${local.id} -> backend: ${backend.id})`);
            } else {
              console.log(`Product mapping exists: ${local.name}`);
              productsCount++; // Include existing in count
            }
          } else if (!backend) {
            console.log(`No backend match for local product: ${local.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to populate product ID mappings:', error);
    }
    
    console.log(`Populated ID mappings: ${customersCount} customers, ${productsCount} products`);
    return { customers: customersCount, products: productsCount };
  },
};
