-- CreateTable
CREATE TABLE "whatsapp_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BAILEYS',
    "session_data" TEXT,
    "phone_number_id" TEXT,
    "access_token" TEXT,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "phone_number" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "whatsapp_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "business_id" TEXT NOT NULL,
    "trigger_days" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reminder_schedules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT,
    "invoice_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" DATETIME,
    "delivered_at" DATETIME,
    "read_at" DATETIME,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminder_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "reminder_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reminder_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_business_id_key" ON "whatsapp_configs"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_schedules_business_id_trigger_days_key" ON "reminder_schedules"("business_id", "trigger_days");

-- CreateIndex
CREATE INDEX "reminder_logs_invoice_id_idx" ON "reminder_logs"("invoice_id");

-- CreateIndex
CREATE INDEX "reminder_logs_schedule_id_idx" ON "reminder_logs"("schedule_id");

-- CreateIndex
CREATE INDEX "reminder_logs_status_idx" ON "reminder_logs"("status");
