-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logo_url" TEXT,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_account_name" TEXT,
    "default_currency_code" TEXT NOT NULL DEFAULT 'IDR',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "businesses_default_currency_code_fkey" FOREIGN KEY ("default_currency_code") REFERENCES "currencies" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "minor_unit" INTEGER NOT NULL,
    "symbol_position" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" BIGINT NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_number_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "reset_period" TEXT NOT NULL,
    "last_period_key" TEXT,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoice_number_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "issue_date" DATETIME NOT NULL,
    "due_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL,
    "currency_minor_unit" INTEGER NOT NULL,
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount_type" TEXT,
    "discount_value" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL DEFAULT 1.0,
    "unit_price" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reminder_templates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delete_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "requested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_by_user_id" TEXT,
    "reviewed_at" DATETIME,
    "reviewed_by_user_id" TEXT,
    "processed_at" DATETIME,
    "processed_by_user_id" TEXT,
    CONSTRAINT "delete_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "delete_requests_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "reason" TEXT,
    "start_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" DATETIME,
    "created_by_user_id" TEXT,
    "released_at" DATETIME,
    "released_by_user_id" TEXT,
    CONSTRAINT "legal_holds_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "legal_holds_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "legal_holds_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_user_id_key" ON "businesses"("user_id");

-- CreateIndex
CREATE INDEX "customers_business_id_name_idx" ON "customers"("business_id", "name");

-- CreateIndex
CREATE INDEX "products_business_id_name_idx" ON "products"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_rules_business_id_key" ON "invoice_number_rules"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_public_id_key" ON "invoices"("public_id");

-- CreateIndex
CREATE INDEX "invoices_business_id_status_idx" ON "invoices"("business_id", "status");

-- CreateIndex
CREATE INDEX "invoices_business_id_due_date_idx" ON "invoices"("business_id", "due_date");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_business_id_invoice_number_key" ON "invoices"("business_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_date_idx" ON "payments"("invoice_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_templates_business_id_type_key" ON "reminder_templates"("business_id", "type");

-- CreateIndex
CREATE INDEX "delete_requests_business_id_status_idx" ON "delete_requests"("business_id", "status");

-- CreateIndex
CREATE INDEX "delete_requests_business_id_resource_type_resource_id_idx" ON "delete_requests"("business_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "legal_holds_business_id_resource_type_resource_id_idx" ON "legal_holds"("business_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "legal_holds_business_id_released_at_idx" ON "legal_holds"("business_id", "released_at");
