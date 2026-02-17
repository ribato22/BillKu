import { Injectable } from '@nestjs/common';
import { Invoice } from '@prisma/client';

interface InvoiceWithRelations {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  subtotal: bigint;
  discountAmount: bigint;
  taxRate: bigint;
  taxAmount: bigint;
  total: bigint;
  notes?: string | null;
  business: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
    logoUrl?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: bigint;
    amount: bigint;
  }>;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: string;
  };
}

@Injectable()
export class InvoiceTemplateService {
  formatCurrency(amount: number | bigint, currency: { code: string; symbol: string; symbolPosition: string }): string {
    const numAmount = typeof amount === 'bigint' ? Number(amount) / 100 : amount / 100;
    const formatted = numAmount.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    if (currency.symbolPosition === 'before') {
      return `${currency.symbol}${formatted}`;
    }
    return `${formatted} ${currency.symbol}`;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  generateHtml(invoice: InvoiceWithRelations): string {
    const itemsHtml = invoice.items
      .map(
        (item, index) => `
        <tr style="background:${index % 2 === 1 ? '#f8fafc' : '#ffffff'}">
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8">${index + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:500">${item.description}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right">${this.formatCurrency(item.unitPrice, invoice.currency)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600">${this.formatCurrency(item.amount, invoice.currency)}</td>
        </tr>
      `,
      )
      .join('');

    const logoHtml = invoice.business.logoUrl
      ? `<img src="${invoice.business.logoUrl}" alt="Logo" style="height:56px;width:56px;object-fit:contain;border-radius:8px;background:#fff;padding:4px;margin-right:12px" />`
      : '';

    const bankHtml = invoice.business.bankName || invoice.business.bankAccountNumber
      ? `<div style="margin-top:32px;padding:20px 24px;background:#f0fdfa;border-radius:10px;border:1px solid #99f6e4">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#0f766e;font-weight:600;margin-bottom:10px">Informasi Pembayaran</div>
          <table style="width:100%"><tr>
            ${invoice.business.bankName ? `<td style="font-size:13px;padding-right:40px"><div style="color:#6b7280;margin-bottom:2px">Bank</div><div style="font-weight:600">${invoice.business.bankName}</div></td>` : ''}
            ${invoice.business.bankAccountNumber ? `<td style="font-size:13px;padding-right:40px"><div style="color:#6b7280;margin-bottom:2px">No. Rekening</div><div style="font-weight:600">${invoice.business.bankAccountNumber}</div></td>` : ''}
            ${invoice.business.bankAccountName ? `<td style="font-size:13px"><div style="color:#6b7280;margin-bottom:2px">Atas Nama</div><div style="font-weight:600">${invoice.business.bankAccountName}</div></td>` : ''}
          </tr></table>
        </div>`
      : '';

    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; line-height: 1.6; }
    @media print { * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; } }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);padding:32px 40px;border-radius:12px 12px 0 0">
      <table style="width:100%"><tr>
        <td style="vertical-align:middle">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#ffffff;opacity:0.8;margin-bottom:4px">Invoice</div>
          <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">${invoice.invoiceNumber}</div>
        </td>
        <td style="text-align:right;vertical-align:middle">
          <table style="margin-left:auto"><tr>
            ${logoHtml ? `<td style="vertical-align:middle">${logoHtml}</td>` : ''}
            <td style="vertical-align:middle">
              <div style="font-size:20px;font-weight:700;color:#ffffff">${invoice.business.name}</div>
              ${invoice.business.address ? `<div style="font-size:12px;color:#ffffff;opacity:0.8;margin-top:2px">${invoice.business.address}</div>` : ''}
            </td>
          </tr></table>
        </td>
      </tr></table>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 40px">
      <!-- Customer & Dates -->
      <table style="width:100%;margin-bottom:32px"><tr>
        <td style="vertical-align:top;width:50%">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:8px">Ditagihkan Kepada</div>
          <div style="font-size:18px;font-weight:600;margin-bottom:4px">${invoice.customer.name}</div>
          ${invoice.customer.address ? `<div style="font-size:13px;color:#6b7280">${invoice.customer.address}</div>` : ''}
          ${invoice.customer.phone ? `<div style="font-size:13px;color:#6b7280">${invoice.customer.phone}</div>` : ''}
          ${invoice.customer.email ? `<div style="font-size:13px;color:#6b7280">${invoice.customer.email}</div>` : ''}
        </td>
        <td style="text-align:right;vertical-align:top;width:50%">
          <div style="margin-bottom:12px">
            <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background:${invoice.status === 'paid' ? '#d1fae5' : invoice.status === 'overdue' ? '#fee2e2' : invoice.status === 'sent' ? '#dbeafe' : '#e5e7eb'};color:${invoice.status === 'paid' ? '#047857' : invoice.status === 'overdue' ? '#dc2626' : invoice.status === 'sent' ? '#1d4ed8' : '#4b5563'}">${invoice.status}</span>
          </div>
          <div style="font-size:13px;color:#6b7280">
            <div style="margin-bottom:4px">Tanggal: <strong style="color:#1f2937">${this.formatDate(invoice.issueDate)}</strong></div>
            <div>Jatuh Tempo: <strong style="color:#dc2626">${this.formatDate(invoice.dueDate)}</strong></div>
          </div>
        </td>
      </tr></table>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Deskripsi</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Harga Satuan</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totals -->
      <table style="margin-left:auto;width:300px">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280">Subtotal</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;color:#1f2937">${this.formatCurrency(invoice.subtotal, invoice.currency)}</td>
        </tr>
        ${Number(invoice.discountAmount) > 0 ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#16a34a">Diskon</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;color:#16a34a">-${this.formatCurrency(invoice.discountAmount, invoice.currency)}</td>
        </tr>` : ''}
        ${Number(invoice.taxAmount) > 0 ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6b7280">Pajak (${Number(invoice.taxRate) / 100}%)</td>
          <td style="padding:6px 0;font-size:13px;text-align:right;color:#1f2937">${this.formatCurrency(invoice.taxAmount, invoice.currency)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 0;font-size:18px;font-weight:700;border-top:2px solid #0f766e">Total</td>
          <td style="padding:12px 0;font-size:18px;font-weight:700;text-align:right;border-top:2px solid #0f766e;color:#0f766e">${this.formatCurrency(invoice.total, invoice.currency)}</td>
        </tr>
      </table>

      ${bankHtml}

      ${invoice.notes ? `
      <div style="margin-top:24px;padding:16px 20px;background:#fefce8;border-radius:8px;border:1px solid #fde68a">
        <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">Catatan</div>
        <div style="font-size:13px;color:#78350f">${invoice.notes}</div>
      </div>` : ''}

      <!-- Signature Area -->
      <table style="width:100%;margin-top:48px"><tr>
        <td style="width:40%;text-align:center;vertical-align:top">
          <div style="font-size:12px;color:#6b7280;margin-bottom:64px">Penerima</div>
          <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:13px">Tanda Tangan & Nama</div>
        </td>
        <td style="width:20%"></td>
        <td style="width:40%;text-align:center;vertical-align:top">
          <div style="font-size:12px;color:#6b7280;margin-bottom:64px">Hormat Kami,</div>
          <div style="border-top:1px solid #d1d5db;padding-top:8px;font-size:13px;font-weight:600">${invoice.business.name}</div>
        </td>
      </tr></table>

      <!-- Footer -->
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center">
        <p style="font-size:12px;color:#9ca3af">Terima kasih atas kepercayaan Anda.</p>
        <p style="font-size:11px;color:#d1d5db;margin-top:4px">Invoice ini dibuat secara digital oleh BillKu • billku.id</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  generateCsv(invoice: InvoiceWithRelations): string {
    const headers = ['No', 'Deskripsi', 'Qty', 'Harga Satuan', 'Jumlah'];
    const rows = invoice.items.map((item, index) => [
      index + 1,
      `"${item.description.replace(/"/g, '""')}"`,
      item.quantity,
      Number(item.unitPrice) / 100,
      Number(item.amount) / 100,
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(['', '', '', 'Subtotal', Number(invoice.subtotal) / 100]);
    if (Number(invoice.discountAmount) > 0) {
      rows.push(['', '', '', 'Diskon', -Number(invoice.discountAmount) / 100]);
    }
    if (Number(invoice.taxAmount) > 0) {
      rows.push(['', '', '', `Pajak (${Number(invoice.taxRate) / 100}%)`, Number(invoice.taxAmount) / 100]);
    }
    rows.push(['', '', '', 'TOTAL', Number(invoice.total) / 100]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // BOM for Excel UTF-8 compatibility
    return '\ufeff' + csvContent;
  }
}
