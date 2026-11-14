-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "order_date" DATETIME NOT NULL,
    "expected_date" DATETIME,
    "notes" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'IDR',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "converted_invoice_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "credit_note_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issue_date" DATETIME NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "applied_amount" BIGINT NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "credit_notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credit_note_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "credit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_email" TEXT,
    "vendor_phone" TEXT,
    "order_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "order_date" DATETIME NOT NULL,
    "expected_date" DATETIME,
    "notes" TEXT,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_business_id_order_number_key" ON "sales_orders"("business_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_business_id_credit_note_number_key" ON "credit_notes"("business_id", "credit_note_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_business_id_order_number_key" ON "purchase_orders"("business_id", "order_number");
