-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "invited_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'IDR',
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "next_due_date" DATETIME NOT NULL,
    "due_day_offset" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_generated" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recurring_invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recurring_invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurring_invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL DEFAULT 1.0,
    "unit_price" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "recurring_invoice_items_recurring_invoice_id_fkey" FOREIGN KEY ("recurring_invoice_id") REFERENCES "recurring_invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_business_id_is_active_idx" ON "recurring_invoices"("business_id", "is_active");
