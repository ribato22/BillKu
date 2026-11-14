-- CreateTable
CREATE TABLE "payment_gateway_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "server_key" TEXT NOT NULL,
    "client_key" TEXT,
    "merchant_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sandbox" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payment_gateway_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "external_id" TEXT,
    "payment_url" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" DATETIME NOT NULL,
    "paid_at" DATETIME,
    "webhook_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payment_links_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_links_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "payment_gateway_configs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_configs_business_id_provider_key" ON "payment_gateway_configs"("business_id", "provider");

-- CreateIndex
CREATE INDEX "payment_links_invoice_id_idx" ON "payment_links"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_links_external_id_idx" ON "payment_links"("external_id");

-- CreateIndex
CREATE INDEX "payment_links_status_idx" ON "payment_links"("status");
