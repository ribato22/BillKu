-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "city" TEXT;
ALTER TABLE "businesses" ADD COLUMN "country" TEXT DEFAULT 'Indonesia';
ALTER TABLE "businesses" ADD COLUMN "email" TEXT;
ALTER TABLE "businesses" ADD COLUMN "phone" TEXT;
ALTER TABLE "businesses" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "businesses" ADD COLUMN "smtp_from" TEXT;
ALTER TABLE "businesses" ADD COLUMN "smtp_host" TEXT;
ALTER TABLE "businesses" ADD COLUMN "smtp_pass" TEXT;
ALTER TABLE "businesses" ADD COLUMN "smtp_port" INTEGER;
ALTER TABLE "businesses" ADD COLUMN "smtp_user" TEXT;
ALTER TABLE "businesses" ADD COLUMN "state" TEXT;
ALTER TABLE "businesses" ADD COLUMN "tax_id" TEXT;
ALTER TABLE "businesses" ADD COLUMN "website" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "npwp" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "changes" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issue_date" DATETIME NOT NULL,
    "valid_until" DATETIME NOT NULL,
    "notes" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'IDR',
    "converted_invoice_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "quotations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotation_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL DEFAULT 1.0,
    "unit_price" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "note_number" TEXT NOT NULL,
    "delivery_date" DATETIME NOT NULL,
    "recipient" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delivery_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delivery_note_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "delivery_note_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL DEFAULT 1.0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "category_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'IDR',
    "date" DATETIME NOT NULL,
    "vendor_name" TEXT,
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "expenses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "html_body" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoice_templates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_fields_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "custom_field_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "custom_field_values_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "custom_fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" BIGINT NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "track_stock" BOOLEAN NOT NULL DEFAULT false,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_alert" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_products" ("business_id", "created_at", "id", "name", "price", "unit", "updated_at") SELECT "business_id", "created_at", "id", "name", "price", "unit", "updated_at" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE INDEX "products_business_id_name_idx" ON "products"("business_id", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "audit_logs_business_id_created_at_idx" ON "audit_logs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_resource_idx" ON "audit_logs"("business_id", "resource");

-- CreateIndex
CREATE INDEX "quotations_business_id_status_idx" ON "quotations"("business_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_business_id_quotation_number_key" ON "quotations"("business_id", "quotation_number");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_business_id_note_number_key" ON "delivery_notes"("business_id", "note_number");

-- CreateIndex
CREATE INDEX "expenses_business_id_date_idx" ON "expenses"("business_id", "date");

-- CreateIndex
CREATE INDEX "expenses_business_id_category_type_idx" ON "expenses"("business_id", "category_type");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_business_id_entity_field_name_key" ON "custom_fields"("business_id", "entity", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_custom_field_id_entity_id_key" ON "custom_field_values"("custom_field_id", "entity_id");
