# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-02-17

### Fixed
- CD workflow health check now uses retry loop (up to 5 minutes) instead of single 30s sleep
- Quotation-to-invoice conversion now correctly calculates `subtotal` and `total` from items

### Added
- Docker Hub auto-publish workflow (`.github/workflows/docker-publish.yml`)
- Docker Hub images: `ribato/billku` and `ribato/billku-frontend`
- GitHub Actions CD workflow for automated production deployments

### Improved
- CD workflow builds all services (not just API) and prunes old images
- Updated `package.json` with proper metadata (name, version, repository, license, keywords)
- README updated with Docker Hub pull instructions
- Enhanced social preview image for GitHub repository

## [1.0.0] - 2026-02-17

### Added

**Core Billing**
- Customer management with CRUD operations, search, and tax ID support
- Product & inventory management with stock tracking
- Full invoice lifecycle (Draft → Sent → Partial → Paid → Overdue)
- Payment recording with multiple methods and partial payment support
- Quotation management with email/WhatsApp delivery and invoice conversion
- Delivery notes with auto-fill from invoices
- Credit notes with invoice application
- Purchase orders and sales orders
- Recurring invoices with daily automated generation (cron)
- e-Meterai integration (PERURI-ready)
- Multi-currency support (10+ currencies)
- Customizable invoice numbering patterns

**Financial Reports**
- Real-time dashboard with KPI widgets
- Profit & Loss statement
- Balance Sheet
- Cash Flow statement
- General Ledger
- Receivables aging report
- Revenue reports with chart data
- CSV export and e-Faktur tax export

**CRM**
- Deal pipeline with 5 configurable stages
- Activity tracking (calls, emails, meetings)
- Customer tagging and segmentation

**Business Tools**
- POS (Point of Sale) with session management and receipt generation
- HR & Payroll (employees, attendance, salary calculation, social security)
- E-commerce marketplace sync (Tokopedia, Shopee, Lazada, Bukalapak)
- Custom fields for extensible data models
- WhatsApp automated invoice reminders
- Payment gateway integration (Midtrans, Xendit, DOKU, iPaymu, Tripay)
- Payment links with public payment page

**Platform**
- Multi-user with role-based access control (Owner, Admin, Staff, Viewer)
- Comprehensive audit logging
- GDPR compliance (data deletion requests, legal holds)
- JWT authentication (access + refresh tokens)
- Customizable invoice templates with PDF export
- Email & WhatsApp notifications
- Interactive API documentation (Swagger/OpenAPI)
- Docker deployment with multi-stage builds
- Offline-first PWA architecture
- SQLite (development) and PostgreSQL (production) support
