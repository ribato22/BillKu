-- PostgreSQL migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  minor_unit INTEGER NOT NULL,
  symbol_position TEXT NOT NULL CHECK (symbol_position IN ('prefix','suffix'))
);

CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  default_currency_code TEXT NOT NULL DEFAULT 'IDR' REFERENCES currencies(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_business_name ON customers (business_id, name);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_business_name ON products (business_id, name);

CREATE TABLE invoice_number_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  reset_period TEXT NOT NULL CHECK (reset_period IN ('yearly','monthly','none')),
  last_period_key TEXT,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_number TEXT NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','sent','partial','paid')),
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  currency_minor_unit INTEGER NOT NULL,
  tax_enabled BOOLEAN NOT NULL DEFAULT false,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  subtotal BIGINT NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, invoice_number)
);

CREATE INDEX idx_invoices_business_status ON invoices (business_id, status);
CREATE INDEX idx_invoices_business_due ON invoices (business_id, due_date);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  method TEXT NOT NULL CHECK (method IN ('transfer','cash','ewallet')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_invoice_date ON payments (invoice_id, date);

CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('H_MINUS_3','OVERDUE')),
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, type)
);

CREATE TABLE delete_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('customer','invoice','payment','business')),
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','completed','canceled')) DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processed_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_delete_requests_business_status ON delete_requests (business_id, status);
CREATE INDEX idx_delete_requests_resource ON delete_requests (business_id, resource_type, resource_id);

CREATE TABLE legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('customer','invoice','payment','business')),
  resource_id TEXT NOT NULL,
  reason TEXT,
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  released_at TIMESTAMPTZ,
  released_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_legal_holds_resource ON legal_holds (business_id, resource_type, resource_id);
CREATE INDEX idx_legal_holds_released ON legal_holds (business_id, released_at);
