-- SQLite migration

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  minor_unit INTEGER NOT NULL,
  symbol_position TEXT NOT NULL CHECK (symbol_position IN ('prefix','suffix'))
);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  default_currency_code TEXT NOT NULL DEFAULT 'IDR',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_currency_code) REFERENCES currencies(code)
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_customers_business_name ON customers (business_id, name);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_business_name ON products (business_id, name);

CREATE TABLE invoice_number_rules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  pattern TEXT NOT NULL,
  reset_period TEXT NOT NULL CHECK (reset_period IN ('yearly','monthly','none')),
  last_period_key TEXT,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','sent','partial','paid')),
  currency_code TEXT NOT NULL,
  currency_minor_unit INTEGER NOT NULL,
  tax_enabled INTEGER NOT NULL DEFAULT 0,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (currency_code) REFERENCES currencies(code)
);

CREATE UNIQUE INDEX idx_invoices_business_number ON invoices (business_id, invoice_number);
CREATE INDEX idx_invoices_business_status ON invoices (business_id, status);
CREATE INDEX idx_invoices_business_due ON invoices (business_id, due_date);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('transfer','cash','ewallet')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (currency_code) REFERENCES currencies(code)
);

CREATE INDEX idx_payments_invoice_date ON payments (invoice_id, date);

CREATE TABLE reminder_templates (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('H_MINUS_3','OVERDUE')),
  template TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (business_id, type),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE delete_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('customer','invoice','payment','business')),
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','completed','canceled')) DEFAULT 'pending',
  reason TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  requested_by_user_id TEXT,
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  processed_at TEXT,
  processed_by_user_id TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_delete_requests_business_status ON delete_requests (business_id, status);
CREATE INDEX idx_delete_requests_resource ON delete_requests (business_id, resource_type, resource_id);

CREATE TABLE legal_holds (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('customer','invoice','payment','business')),
  resource_id TEXT NOT NULL,
  reason TEXT,
  start_at TEXT NOT NULL DEFAULT (datetime('now')),
  end_at TEXT,
  created_by_user_id TEXT,
  released_at TEXT,
  released_by_user_id TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (released_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_legal_holds_resource ON legal_holds (business_id, resource_type, resource_id);
CREATE INDEX idx_legal_holds_released ON legal_holds (business_id, released_at);
