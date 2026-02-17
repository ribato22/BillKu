# API Specification (v1)

**Base URL**
- `/api/v1`

**Auth**
- Header: `Authorization: Bearer <access_token>`
- Refresh token: HttpOnly cookie `refresh_token`

**Response Envelope**
- Success: `{ "data": ..., "meta": ... }`
- Error: `{ "error": { "code": "...", "message": "...", "details": ... } }`

**Conventions**
- `amount` fields are integer minor units.
- `tax_rate_bps`: basis points, 10000 = 100%.
- `discount_type` values: `percent` or `amount`.
- If `discount_type=percent`, `discount_value` is in basis points.
- If `discount_type=amount`, `discount_value` is in minor units.
- `issue_date` and `due_date` use `YYYY-MM-DD`.

**Pagination**
- Query: `page`, `page_size`, `q`, `sort`, `order`.
- Meta: `{ "page": 1, "page_size": 20, "total": 123 }`.

## Auth

`POST /auth/register`
- Request: `email`, `password`, `business_name`
- Response: `user`, `business`, `access_token`, `refresh_token`

`POST /auth/login`
- Request: `email`, `password`
- Response: `access_token`, `refresh_token`, `user`, `business`

`POST /auth/refresh`
- Uses refresh cookie
- Response: `access_token`

`POST /auth/logout`
- Clears refresh cookie
- Response: `{ "success": true }`

`GET /auth/me`
- Response: `user`, `business`

## Business

`GET /business`
- Response: business profile

`PATCH /business`
- Request: `name`, `address`, `logo_url`, `bank_name`, `bank_account_number`, `bank_account_name`, `default_currency_code`
- Response: updated business

## Settings

`GET /settings/currencies`
- Response: list of `{ code, name, symbol, minor_unit, symbol_position }`

`GET /settings/invoice-numbering`
- Response: `{ pattern, reset_period, next_number_preview }`

`PUT /settings/invoice-numbering`
- Request: `pattern`, `reset_period`
- Response: updated rule + preview

`POST /invoices/preview-number`
- Request: `issue_date` (optional)
- Response: `{ next_number }`

## Customers

`GET /customers`
- Query: `page`, `page_size`, `q`
- Response: list customers

`POST /customers`
- Request: `name`, `phone`, `email`, `address`
- Response: customer

`GET /customers/:id`
- Response: customer

`PATCH /customers/:id`
- Request: `name`, `phone`, `email`, `address`
- Response: customer

`DELETE /customers/:id`
- Soft delete, response `{ "success": true }`

## Products

`GET /products`
- Query: `page`, `page_size`, `q`
- Response: list products

`POST /products`
- Request: `name`, `price`, `unit`
- Response: product

`GET /products/:id`
- Response: product

`PATCH /products/:id`
- Request: `name`, `price`, `unit`
- Response: product

`DELETE /products/:id`
- Response: `{ "success": true }`

## Invoices

`GET /invoices`
- Query: `page`, `page_size`, `status`, `customer_id`, `overdue`, `issue_date_from`, `issue_date_to`, `due_date_from`, `due_date_to`, `currency_code`, `q`
- Response: list invoices + totals

`POST /invoices`
- Request: `customer_id`, `issue_date`, `due_date`, `currency_code` (optional), `items`, `discount_type`, `discount_value`, `tax_enabled`, `tax_rate_bps`, `invoice_number_override` (optional)
- Item: `description`, `qty`, `unit_price`, `product_id` (optional)
- Response: invoice + items

`GET /invoices/:id`
- Response: invoice + items + payments

`PATCH /invoices/:id`
- Allowed when status in `draft` or `sent`
- Request: same as create + `status` (optional)
- Response: invoice + items

`POST /invoices/:id/send`
- Sets status to `sent`
- Response: invoice

`GET /invoices/:id/pdf`
- Response: `application/pdf`

`GET /invoices/:id/csv`
- Response: `text/csv`

`GET /invoices/export`
- Query: `format=csv`, `status`, `from`, `to`
- Response: file

## Payments

`POST /invoices/:id/payments`
- Request: `date`, `amount`, `currency_code`, `method`, `note`
- Response: payment + updated invoice

`GET /invoices/:id/payments`
- Response: list payments

`DELETE /payments/:id`
- Response: `{ "success": true }` + updated invoice

## Receivables

`GET /receivables/summary`
- Response: `total_outstanding`, `total_overdue`, `count_invoices`, `currency_code`

`GET /receivables/aging`
- Response: buckets `<7`, `7-14`, `15-30`, `>30` with `amount` and `count`

## Reminders

`GET /reminders/templates`
- Response: list templates

`PUT /reminders/templates/:type`
- Request: `template`
- Response: template

## Public Invoice

`GET /public/invoices/:public_id`
- Response: invoice detail + status
