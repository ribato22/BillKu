-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expected_close_date" DATETIME,
    "notes" TEXT,
    "assigned_to" TEXT,
    "closed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "deals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "deal_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATETIME,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "activities_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    CONSTRAINT "customer_tags_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "cashier_name" TEXT NOT NULL,
    "opening_cash" BIGINT NOT NULL DEFAULT 0,
    "closing_cash" BIGINT,
    "total_sales" BIGINT NOT NULL DEFAULT 0,
    "total_tx" INTEGER NOT NULL DEFAULT 0,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    CONSTRAINT "pos_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pos_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "customer_name" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "tax_amount" BIGINT NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "cash_received" BIGINT,
    "change_amount" BIGINT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pos_transaction_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transaction_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "amount" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "pos_transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "pos_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pos_transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "department" TEXT,
    "join_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "base_salary" BIGINT NOT NULL DEFAULT 0,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "npwp" TEXT,
    "bpjs_kes" TEXT,
    "bpjs_tk" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employees_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "base_salary" BIGINT NOT NULL,
    "allowances" BIGINT NOT NULL DEFAULT 0,
    "overtime" BIGINT NOT NULL DEFAULT 0,
    "deductions" BIGINT NOT NULL DEFAULT 0,
    "bpjs_kes_employee" BIGINT NOT NULL DEFAULT 0,
    "bpjs_kes_company" BIGINT NOT NULL DEFAULT 0,
    "bpjs_tk_employee" BIGINT NOT NULL DEFAULT 0,
    "bpjs_tk_company" BIGINT NOT NULL DEFAULT 0,
    "pph21" BIGINT NOT NULL DEFAULT 0,
    "net_salary" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paid_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payrolls_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payrolls_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "clock_in" DATETIME,
    "clock_out" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendances_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meterai_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 10000,
    "serial_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stamped_at" DATETIME,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meterai_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marketplace_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "shop_id" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "marketplace_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "buyer_phone" TEXT,
    "shipping_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new_order',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "shipping_cost" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "invoice_id" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "marketplace_orders_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "marketplace_connections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "deals_business_id_stage_idx" ON "deals"("business_id", "stage");

-- CreateIndex
CREATE INDEX "activities_business_id_type_idx" ON "activities"("business_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_business_id_customer_id_tag_key" ON "customer_tags"("business_id", "customer_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "pos_transactions_business_id_receipt_number_key" ON "pos_transactions"("business_id", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_business_id_employee_id_key" ON "employees"("business_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_business_id_employee_id_period_key" ON "payrolls"("business_id", "employee_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_business_id_employee_id_date_key" ON "attendances"("business_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "meterai_requests_business_id_document_type_document_id_idx" ON "meterai_requests"("business_id", "document_type", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_connections_business_id_platform_key" ON "marketplace_connections"("business_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_connection_id_external_order_id_key" ON "marketplace_orders"("connection_id", "external_order_id");
