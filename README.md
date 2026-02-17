<div align="center">

<img src="frontend/public/logo.png" alt="BillKu Logo" width="200" />

# BillKu

### Open-Source Billing & Business Management Platform

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/ribato/billku)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/ribato22)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ribato)

**Free & Open Source • Self-Hosted • Offline-Ready • WhatsApp Integrated**

[Live Demo](https://billku.id) · [Documentation](#documentation) · [Quick Start](#quick-start) · [Contributing](CONTRIBUTING.md) · [Sponsor 💖](https://github.com/sponsors/ribato22) · [Report Bug](https://github.com/ribato22/BillKu/issues)

</div>

---

## Overview

BillKu is a comprehensive, self-hosted billing and business management platform designed for small and medium enterprises (SMEs). Built with modern technologies, it provides enterprise-grade features including invoicing, CRM, POS, HR & payroll, inventory management, and financial reporting — all in a single, unified platform.

### Why BillKu?

| Feature | BillKu | Traditional SaaS |
|---------|:------:|:-----------------:|
| **Free forever** | ✅ | ❌ $15–50/mo |
| **Self-hosted** | ✅ | ❌ Vendor lock-in |
| **Offline-first (PWA)** | ✅ | ❌ |
| **Full source access** | ✅ | ❌ |
| **CRM + POS + HR** | ✅ | Pay extra |
| **WhatsApp integration** | ✅ | ❌ |
| **GDPR compliant** | ✅ | Varies |

---

## Features

### 📋 Invoicing & Billing
- Full invoice lifecycle management (Draft → Sent → Partial → Paid → Overdue)
- Quotations with one-click conversion to invoices
- Purchase orders & sales orders
- Credit notes and delivery notes
- Recurring invoices with automated generation (cron-based)
- Customizable invoice templates with PDF export
- Multi-currency support (10+ currencies)
- Flexible invoice numbering with customizable patterns

### 📊 Financial Reporting
- Real-time dashboard with KPI widgets
- Profit & Loss statement
- Balance sheet
- Cash flow statement
- General ledger
- Receivables aging report
- CSV & tax export (e-Faktur ready)

### 🤝 CRM (Customer Relationship Management)
- Deal pipeline with 5 configurable stages
- Activity tracking (calls, emails, meetings)
- Customer tagging and segmentation
- Contact management with transaction history

### 🛒 POS (Point of Sale)
- Session-based cash management
- Fast product search and barcode support
- Auto-deduct inventory on sale
- Receipt generation

### 👥 HR & Payroll
- Employee records (tax ID, social security, bank details)
- Automated payroll generation (base salary + allowances + deductions)
- Attendance tracking (clock in/out)
- Payroll approval workflow

### 🔌 Integrations
- **WhatsApp** — Send invoices and payment reminders automatically
- **Payment Gateways** — Midtrans, Xendit, DOKU, iPaymu, Tripay
- **E-commerce** — Tokopedia, Shopee, Lazada, Bukalapak marketplace sync
- **Email** — SMTP-based notifications
- **PDF** — Server-side PDF generation via Puppeteer

### 🛡️ Platform & Security
- Multi-user with role-based access control (Owner, Admin, Staff, Viewer)
- Comprehensive audit logging
- GDPR compliance (data deletion requests, legal holds)
- Custom fields for extensible data models
- Interactive API documentation (Swagger/OpenAPI)
- Docker-ready deployment

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | NestJS + TypeScript | 10.x / 5.x |
| **Frontend** | Next.js + React | 16.x / 19.x |
| **Database** | SQLite (dev) / PostgreSQL (prod) | — |
| **ORM** | Prisma | 6.x |
| **Authentication** | JWT (access + refresh tokens) | — |
| **PDF Engine** | Puppeteer + Chromium | — |
| **Containerization** | Docker (multi-stage builds) | — |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.x
- [Docker](https://docker.com/) (recommended) or npm/yarn

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/ribato22/BillKu.git
cd BillKu

# Configure environment
cp .env.example .env
# Edit .env with your settings (JWT_SECRET, etc.)

# Start all services
docker compose up -d

# Verify containers are running
docker compose ps
```

#### Pull from Docker Hub

```bash
docker pull ribato/billku:latest
docker pull ribato/billku-frontend:latest
```

**Access the application:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4001 |
| Backend API | http://localhost:4000 |
| API Documentation | http://localhost:4000/api/docs |

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/ribato22/BillKu.git
cd BillKu

# Install backend dependencies
npm install

# Configure environment
cp .env.example .env

# Initialize database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start backend (port 4000)
npm run start:dev
```

In a separate terminal:

```bash
# Install frontend dependencies
cd frontend
npm install

# Start frontend (port 4001)
npm run dev
```

---

## Project Structure

```
BillKu/
├── src/                        # Backend source (NestJS)
│   ├── auth/                   # Authentication & RBAC
│   ├── customers/              # Customer management
│   ├── products/               # Product & inventory
│   ├── invoices/               # Invoice lifecycle
│   ├── payments/               # Payment processing
│   ├── quotations/             # Quotation management
│   ├── crm/                    # CRM module
│   ├── pos/                    # Point of Sale
│   ├── hr/                     # HR & Payroll
│   ├── reports/                # Financial reports
│   ├── settings/               # Application settings
│   └── ...                     # Additional modules
├── frontend/                   # Frontend source (Next.js)
│   ├── src/
│   │   ├── app/                # App router pages
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utility functions
│   └── public/                 # Static assets
├── prisma/                     # Database schema & seeds
├── docs/                       # Technical documentation
├── docker-compose.yaml         # Container orchestration
├── Dockerfile                  # Backend container
└── frontend/Dockerfile         # Frontend container
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret key for JWT signing | — (required) |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `FRONTEND_URL` | Frontend URL (CORS) | `http://localhost:3001` |
| `SMTP_HOST` | SMTP server host | — (optional) |
| `SMTP_PORT` | SMTP server port | `587` |
| `WA_ENABLED` | Enable WhatsApp integration | `false` |

See [`.env.example`](.env.example) for the complete configuration reference.

---

## Deployment

### Production with Docker

```bash
# Clone and configure
git clone https://github.com/ribato22/BillKu.git
cd BillKu
cp .env.example .env

# Set production values
# - Generate a strong JWT_SECRET
# - Set NODE_ENV=production
# - Configure FRONTEND_URL

# Deploy
docker compose up -d --build

# Verify
docker compose ps
curl http://localhost:4000/health
```

### Production with Nginx (Recommended)

For production deployments, use Nginx as a reverse proxy with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Specification](docs/api-spec.md) | REST API endpoints and request/response formats |
| [Technical Design](docs/technical-design.md) | Architecture decisions and system design |
| [Invoice Numbering](docs/invoice-numbering-spec.md) | Customizable invoice number pattern specification |
| [Deletion & Retention](docs/deletion-retention-policy.md) | GDPR-compliant data lifecycle policies |
| [Testing Guide](TESTING_GUIDE.md) | How to run and write tests |
| [Changelog](CHANGELOG.md) | Version history and release notes |

---

## Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our development process, coding standards, and how to submit pull requests.

See also:
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

---

## Support

If BillKu helps your business, consider supporting the project:

<a href="https://github.com/sponsors/ribato22">
  <img src="https://img.shields.io/badge/Sponsor_on_GitHub-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor on GitHub" />
</a>
<a href="https://buymeacoffee.com/ribato">
  <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
</a>

Your support helps us maintain the project and build new features.

---

## License

This project is licensed under the [MIT License](LICENSE) — free for personal and commercial use.

---

<div align="center">

**Built with ❤️ for small businesses everywhere**

[Website](https://billku.id) · [Report Bug](https://github.com/ribato22/BillKu/issues) · [Request Feature](https://github.com/ribato22/BillKu/issues)

</div>
