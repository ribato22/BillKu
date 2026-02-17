# 🧪 BillKu API Testing Guide

Panduan lengkap untuk menguji semua endpoint BillKu API.

## Persiapan

### 1. Jalankan Server

```bash
# Install dependencies (jika belum)
npm install

# Generate Prisma Client
npx prisma generate

# Jalankan migrasi (local SQLite)
DATABASE_URL="file:./billku.db" npx prisma migrate dev

# Start development server
npm run start:dev
```

Server berjalan di `http://localhost:3000`

### 2. Variabel yang Dibutuhkan

```bash
BASE=http://localhost:3000/api/v1
# TOKEN akan didapat setelah register/login
TOKEN="eyJhbG..."
```

### 3. Swagger UI

Buka browser: **http://localhost:3000/api/docs**

---

## 📋 Urutan Testing

Ikuti urutan berikut karena ada dependency antar modul:

1. Auth → 2. Business → 3. Customers → 4. Products → 5. Invoices → 6. Payments
7. Sales Orders → 8. Credit Notes → 9. Purchase Orders → 10. Quotations → 11. Expenses
12. Delivery Notes → 13. Reports → 14. Tax → 15. CRM → 16. POS → 17. HR/Payroll
18. e-Meterai → 19. Marketplace

---

## 1. 🔐 Auth

```bash
# Register
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@billku.test",
    "password": "Test1234!",
    "businessName": "Toko Maju Jaya"
  }' | jq .

# ⬆️ Simpan accessToken dari response sebagai TOKEN
export TOKEN="<paste accessToken di sini>"

# Login
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@billku.test",
    "password": "Test1234!"
  }' | jq .

# Get Profile
curl -s $BASE/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 2. 🏢 Business

```bash
# Get Business Profile
curl -s $BASE/business \
  -H "Authorization: Bearer $TOKEN" | jq .

# Update Business
curl -s -X PATCH $BASE/business \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Toko Maju Jaya",
    "address": "Jl. Sudirman No. 123, Jakarta",
    "phone": "021-5551234",
    "npwp": "12.345.678.9-012.000"
  }' | jq .
```

---

## 3. 👥 Customers

```bash
# Create Customer
curl -s -X POST $BASE/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PT Pelanggan Pertama",
    "email": "pelanggan@example.com",
    "phone": "08123456789",
    "address": "Jl. Gatot Subroto No. 10"
  }' | jq .
# ⬆️ Simpan id sebagai CUSTOMER_ID

# List Customers
curl -s "$BASE/customers" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Get Customer Detail
curl -s $BASE/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

# Update Customer
curl -s -X PATCH $BASE/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "08198765432"}' | jq .
```

---

## 4. 📦 Products

```bash
# Create Product
curl -s -X POST $BASE/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop ASUS ROG",
    "price": 15000000,
    "unit": "unit",
    "description": "Gaming Laptop 16GB RAM"
  }' | jq .
# ⬆️ Simpan id sebagai PRODUCT_ID

# Create Product 2
curl -s -X POST $BASE/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mouse Logitech G502",
    "price": 850000,
    "unit": "unit"
  }' | jq .

# List Products
curl -s "$BASE/products" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 5. 🧾 Invoices

```bash
# Create Invoice
curl -s -X POST $BASE/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "issueDate": "2026-02-16",
    "dueDate": "2026-03-16",
    "currencyCode": "IDR",
    "items": [
      {
        "description": "Laptop ASUS ROG",
        "qty": 2,
        "unitPrice": 15000000,
        "productId": "'$PRODUCT_ID'"
      },
      {
        "description": "Mouse Logitech G502",
        "qty": 5,
        "unitPrice": 850000
      }
    ]
  }' | jq .
# ⬆️ Simpan id sebagai INVOICE_ID

# List Invoices
curl -s "$BASE/invoices" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Get Invoice Detail
curl -s $BASE/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

# Update Invoice Status
curl -s -X PATCH $BASE/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "sent"}' | jq .

# Download Invoice PDF (jika PDF module aktif)
curl -s $BASE/invoices/$INVOICE_ID/pdf \
  -H "Authorization: Bearer $TOKEN" --output invoice.pdf
```

---

## 6. 💳 Payments

```bash
# Record Payment
curl -s -X POST $BASE/invoices/$INVOICE_ID/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000000,
    "date": "2026-02-16",
    "method": "bank_transfer",
    "reference": "TRF-20260216-001"
  }' | jq .

# List Payments per Invoice
curl -s $BASE/invoices/$INVOICE_ID/payments \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 7. 📋 Sales Orders

```bash
# Create Sales Order
curl -s -X POST $BASE/sales-orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "currencyCode": "IDR",
    "items": [
      {"description": "Laptop ASUS ROG", "qty": 3, "unitPrice": 15000000}
    ]
  }' | jq .
# ⬆️ Simpan id sebagai SO_ID

# List Sales Orders
curl -s "$BASE/sales-orders" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ⭐ Convert to Invoice
curl -s -X POST $BASE/sales-orders/$SO_ID/convert-to-invoice \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 8. 📝 Credit Notes

```bash
# Create Credit Note
curl -s -X POST $BASE/credit-notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "invoiceId": "'$INVOICE_ID'",
    "reason": "Barang rusak / retur",
    "currencyCode": "IDR",
    "items": [
      {"description": "Retur Mouse Logitech G502", "qty": 1, "unitPrice": 850000}
    ]
  }' | jq .
# ⬆️ Simpan id sebagai CN_ID

# Apply Credit Note to Invoice
curl -s -X POST $BASE/credit-notes/$CN_ID/apply \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 9. 🛒 Purchase Orders

```bash
# Create Purchase Order
curl -s -X POST $BASE/purchase-orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierName": "CV Distributor Elektronik",
    "currencyCode": "IDR",
    "items": [
      {"description": "Laptop ASUS ROG (restock)", "qty": 10, "unitPrice": 12000000, "productId": "'$PRODUCT_ID'"}
    ]
  }' | jq .
# ⬆️ Simpan id sebagai PO_ID

# ⭐ Receive Stock (auto-adjusts inventory)
curl -s -X POST $BASE/purchase-orders/$PO_ID/receive \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 10. 📄 Quotations

```bash
# Create Quotation
curl -s -X POST $BASE/quotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "validUntil": "2026-03-16",
    "items": [
      {"description": "Laptop ASUS ROG", "qty": 5, "unitPrice": 15000000}
    ]
  }' | jq .
```

---

## 11. 💸 Expenses

```bash
# Create Expense
curl -s -X POST $BASE/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Sewa Kantor Bulan Februari",
    "amount": 5000000,
    "date": "2026-02-01",
    "category": "rent"
  }' | jq .
```

---

## 12. 🚚 Delivery Notes

```bash
# Create Delivery Note
curl -s -X POST $BASE/delivery-notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "invoiceId": "'$INVOICE_ID'",
    "items": [
      {"description": "Laptop ASUS ROG", "qty": 2}
    ]
  }' | jq .
```

---

## 13. 📊 Reports

```bash
# Cash Flow Report
curl -s "$BASE/reports/cashflow?year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq .

# General Ledger
curl -s "$BASE/reports/general-ledger?year=2026&month=2" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Receivables Aging
curl -s "$BASE/receivables/aging" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 14. 🧾 Tax / e-Faktur

```bash
# Get Tax Summary
curl -s "$BASE/tax/summary?period=2026-02" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ⭐ Export e-Faktur DJP CSV
curl -s "$BASE/tax/efaktur-csv?period=2026-02" \
  -H "Authorization: Bearer $TOKEN" --output efaktur.csv
```

---

## 15. 🤝 CRM

```bash
# Create Deal
curl -s -X POST $BASE/crm/deals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Proyek Pengadaan IT PT ABC",
    "customerId": "'$CUSTOMER_ID'",
    "value": 150000000,
    "stage": "qualified"
  }' | jq .
# ⬆️ Simpan id sebagai DEAL_ID

# Pipeline Overview
curl -s "$BASE/crm/deals/pipeline" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Add Activity to Deal
curl -s -X POST $BASE/crm/deals/$DEAL_ID/activities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call",
    "subject": "Follow up proposal",
    "notes": "Klien tertarik, minta revisi harga",
    "date": "2026-02-16"
  }' | jq .

# Update Deal Stage
curl -s -X PATCH $BASE/crm/deals/$DEAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stage": "proposal"}' | jq .

# Tag Customer
curl -s -X POST $BASE/crm/customers/$CUSTOMER_ID/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "VIP"}' | jq .
```

---

## 16. 🏪 POS (Point of Sale)

```bash
# Open Session (Buka Kasir)
curl -s -X POST $BASE/pos/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"openingCash": 500000}' | jq .
# ⬆️ Simpan id sebagai SESSION_ID

# Search Products (untuk kasir)
curl -s "$BASE/pos/products/search?q=Laptop" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create Transaction
curl -s -X POST $BASE/pos/sessions/$SESSION_ID/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "cash",
    "cashReceived": 20000000,
    "items": [
      {"productId": "'$PRODUCT_ID'", "name": "Laptop ASUS ROG", "qty": 1, "unitPrice": 15000000}
    ]
  }' | jq .

# Get Session with Transactions
curl -s "$BASE/pos/sessions/$SESSION_ID/transactions" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Close Session (Tutup Kasir)
curl -s -X POST $BASE/pos/sessions/$SESSION_ID/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actualCash": 15500000}' | jq .

# Daily Report
curl -s "$BASE/pos/sessions?date=2026-02-16" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 17. 👨‍💼 HR / Payroll

```bash
# Create Employee
curl -s -X POST $BASE/hr/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-001",
    "name": "Budi Santoso",
    "email": "budi@billku.test",
    "phone": "08123456789",
    "position": "Staff IT",
    "department": "IT",
    "joinDate": "2025-01-15",
    "baseSalary": 8000000,
    "bankName": "BCA",
    "bankAccount": "1234567890",
    "npwp": "12.345.678.9-012.000",
    "bpjsKes": "00123456789",
    "bpjsTk": "00987654321"
  }' | jq .
# ⬆️ Simpan id sebagai EMP_ID

# Create Employee 2
curl -s -X POST $BASE/hr/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP-002",
    "name": "Siti Rahayu",
    "email": "siti@billku.test",
    "position": "Staff Keuangan",
    "department": "Finance",
    "joinDate": "2025-03-01",
    "baseSalary": 7500000
  }' | jq .

# List Employees
curl -s "$BASE/hr/employees" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ⭐ Generate Payroll (auto BPJS + PPh21)
curl -s -X POST $BASE/hr/payroll/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period": "2026-02"}' | jq .
# ⬆️ Simpan payroll id sebagai PAYROLL_ID

# View Payroll
curl -s "$BASE/hr/payroll?period=2026-02" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Approve Payroll
curl -s -X POST $BASE/hr/payroll/$PAYROLL_ID/approve \
  -H "Authorization: Bearer $TOKEN" | jq .

# Mark as Paid
curl -s -X POST $BASE/hr/payroll/$PAYROLL_ID/pay \
  -H "Authorization: Bearer $TOKEN" | jq .

# Record Attendance
curl -s -X POST $BASE/hr/attendance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "'$EMP_ID'",
    "date": "2026-02-16",
    "status": "present",
    "clockIn": "2026-02-16T08:00:00",
    "clockOut": "2026-02-16T17:00:00"
  }' | jq .

# Attendance Report
curl -s "$BASE/hr/attendance?month=2026-02" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 18. 📜 e-Meterai

```bash
# ⭐ Stamp Meterai (hanya untuk dokumen ≥ Rp 5 juta)
curl -s -X POST $BASE/meterai/stamp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentType": "invoice",
    "documentId": "'$INVOICE_ID'"
  }' | jq .
# ⬆️ Simpan serialNumber sebagai SERIAL

# History
curl -s "$BASE/meterai/history" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Stats
curl -s "$BASE/meterai/stats?period=2026-02" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Verify
curl -s "$BASE/meterai/verify/$SERIAL" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 19. 🛍️ Marketplace

```bash
# Connect Platform
curl -s -X POST $BASE/marketplace/connections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "tokopedia",
    "shopName": "Toko Maju Jaya Official",
    "shopId": "12345678",
    "accessToken": "tok_sample_token_123"
  }' | jq .
# ⬆️ Simpan id sebagai CONN_ID

# List Connections
curl -s "$BASE/marketplace/connections" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Sync Orders
curl -s -X POST $BASE/marketplace/connections/$CONN_ID/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      {
        "externalOrderId": "TKP-2026021600001",
        "buyerName": "Ahmad Buyer",
        "buyerPhone": "08111222333",
        "shippingAddress": "Jl. Mangga No. 5, Bandung",
        "status": "delivered",
        "subtotal": 15000000,
        "shippingCost": 25000,
        "total": 15025000
      },
      {
        "externalOrderId": "TKP-2026021600002",
        "buyerName": "Dewi Buyer",
        "status": "processing",
        "subtotal": 850000,
        "shippingCost": 15000,
        "total": 865000
      }
    ]
  }' | jq .
# ⬆️ Simpan order id pertama sebagai ORDER_ID

# List Orders
curl -s "$BASE/marketplace/orders" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ⭐ Convert Order to Invoice
curl -s -X POST $BASE/marketplace/orders/$ORDER_ID/convert-to-invoice \
  -H "Authorization: Bearer $TOKEN" | jq .

# Dashboard
curl -s "$BASE/marketplace/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## ✅ Checklist Testing

| # | Modul | Endpoints | Status |
|---|-------|-----------|--------|
| 1 | Auth | register, login, me, refresh, logout | ⬜ |
| 2 | Business | get, update | ⬜ |
| 3 | Customers | CRUD | ⬜ |
| 4 | Products | CRUD | ⬜ |
| 5 | Invoices | CRUD, PDF | ⬜ |
| 6 | Payments | create, list | ⬜ |
| 7 | Sales Orders | CRUD, convert-to-invoice | ⬜ |
| 8 | Credit Notes | CRUD, apply | ⬜ |
| 9 | Purchase Orders | CRUD, receive | ⬜ |
| 10 | Quotations | CRUD | ⬜ |
| 11 | Expenses | CRUD | ⬜ |
| 12 | Delivery Notes | CRUD | ⬜ |
| 13 | Reports | cashflow, ledger, aging | ⬜ |
| 14 | Tax | summary, e-Faktur CSV | ⬜ |
| 15 | CRM | deals CRUD, pipeline, activities, tags | ⬜ |
| 16 | POS | sessions, transactions, close, search | ⬜ |
| 17 | HR/Payroll | employees, generate, approve, pay, attendance | ⬜ |
| 18 | e-Meterai | stamp, history, stats, verify | ⬜ |
| 19 | Marketplace | connect, sync, orders, convert, dashboard | ⬜ |

---

## 🔧 Tips

1. **Simpan Token**: Selalu `export TOKEN=...` setelah login/register
2. **Simpan ID**: Setiap response `create` berisi `id`, simpan untuk operasi berikutnya
3. **Swagger UI**: Gunakan `http://localhost:3000/api/docs` untuk testing interaktif
4. **Error Handling**: Semua error mengembalikan format `{ "statusCode": 4xx, "message": "..." }`
5. **Pagination**: Gunakan query `?page=1&limit=20` untuk endpoint list
6. **jq**: Install `jq` dengan `brew install jq` untuk pretty-print JSON response
