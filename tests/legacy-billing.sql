INSERT INTO users (id, email, password_hash, updated_at)
VALUES ('legacy-user', 'legacy@example.invalid', 'synthetic', '2026-02-20T00:00:00.000Z');
INSERT INTO businesses (id, user_id, name, updated_at)
VALUES ('legacy-business', 'legacy-user', 'Legacy Business', '2026-02-20T00:00:00.000Z');
INSERT INTO customers (id, business_id, name, updated_at)
VALUES ('legacy-customer', 'legacy-business', 'Legacy Customer', '2026-02-20T00:00:00.000Z');
INSERT INTO invoices (id, business_id, customer_id, invoice_number, public_id, issue_date, due_date,
                      status, currency_code, currency_minor_unit, subtotal, total, updated_at)
VALUES ('legacy-invoice', 'legacy-business', 'legacy-customer', 'TEST-001', 'legacy-public',
        '2026-02-20T00:00:00.000Z', '2026-03-06T00:00:00.000Z', 'partial', 'IDR', 0, 200000, 200000, '2026-02-20T00:00:00.000Z');
INSERT INTO invoice_items (id, invoice_id, description, qty, unit_price, total)
VALUES ('legacy-item', 'legacy-invoice', 'Legacy item', 2, 100000, 200000);
INSERT INTO payments (id, invoice_id, date, amount, currency_code, method)
VALUES ('legacy-payment', 'legacy-invoice', '2026-02-20T00:00:00.000Z', 75000, 'IDR', 'cash');
