-- Seed currencies for SQLite

INSERT OR IGNORE INTO currencies (code, name, symbol, minor_unit, symbol_position) VALUES
  ('IDR', 'Indonesian Rupiah', 'Rp', 0, 'prefix'),
  ('USD', 'US Dollar', '$', 2, 'prefix'),
  ('SGD', 'Singapore Dollar', 'S$', 2, 'prefix'),
  ('EUR', 'Euro', '€', 2, 'prefix'),
  ('JPY', 'Japanese Yen', '¥', 0, 'prefix'),
  ('AUD', 'Australian Dollar', 'A$', 2, 'prefix'),
  ('GBP', 'British Pound', '£', 2, 'prefix'),
  ('CNY', 'Chinese Yuan', '¥', 2, 'prefix'),
  ('MYR', 'Malaysian Ringgit', 'RM', 2, 'prefix'),
  ('THB', 'Thai Baht', '฿', 2, 'prefix');
