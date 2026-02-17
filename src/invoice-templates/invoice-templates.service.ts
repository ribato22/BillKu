import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto';

const BUILT_IN_TEMPLATES = [
  {
    name: 'Classic',
    htmlBody: `<div style="font-family:serif;max-width:800px;margin:0 auto;padding:40px">
  <div style="display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:20px">
    <div><h1 style="margin:0;font-size:28px">{{businessName}}</h1><p style="color:#666">{{businessAddress}}</p></div>
    <div style="text-align:right"><h2 style="margin:0;color:#333">INVOICE</h2><p>#{{invoiceNumber}}</p><p>Tanggal: {{issueDate}}</p><p>Jatuh Tempo: {{dueDate}}</p></div>
  </div>
  <div style="margin-bottom:20px"><strong>Kepada:</strong><p>{{customerName}}</p><p>{{customerAddress}}</p></div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px"><thead><tr style="background:#f5f5f5"><th style="border:1px solid #ddd;padding:8px;text-align:left">Deskripsi</th><th style="border:1px solid #ddd;padding:8px;text-align:right">Qty</th><th style="border:1px solid #ddd;padding:8px;text-align:right">Harga</th><th style="border:1px solid #ddd;padding:8px;text-align:right">Total</th></tr></thead><tbody>{{#items}}<tr><td style="border:1px solid #ddd;padding:8px">{{description}}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">{{qty}}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">{{unitPrice}}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">{{total}}</td></tr>{{/items}}</tbody></table>
  <div style="text-align:right;font-size:18px;font-weight:bold;border-top:2px solid #333;padding-top:10px">Total: {{currencySymbol}} {{grandTotal}}</div>
  <div style="margin-top:30px;padding:15px;background:#f9f9f9;border-radius:4px"><strong>Info Pembayaran:</strong><p>Bank: {{bankName}}</p><p>No. Rek: {{bankAccountNumber}}</p><p>A/N: {{bankAccountName}}</p></div>
</div>`,
  },
  {
    name: 'Modern',
    htmlBody: `<div style="font-family:'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px">
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:12px;margin-bottom:30px">
    <h1 style="margin:0;font-size:24px">{{businessName}}</h1><p style="opacity:0.8;margin:5px 0">{{businessAddress}}</p>
    <div style="margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.3)"><span style="font-size:20px;font-weight:bold">INVOICE #{{invoiceNumber}}</span></div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:25px">
    <div><h3 style="color:#667eea;margin:0 0 5px">Kepada</h3><p style="margin:0">{{customerName}}</p><p style="margin:0;color:#666">{{customerAddress}}</p></div>
    <div style="text-align:right"><p style="margin:2px 0"><strong>Tanggal:</strong> {{issueDate}}</p><p style="margin:2px 0"><strong>Jatuh Tempo:</strong> {{dueDate}}</p></div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:25px"><thead><tr><th style="background:#667eea;color:white;padding:12px;text-align:left;border-radius:6px 0 0 0">Deskripsi</th><th style="background:#667eea;color:white;padding:12px;text-align:right">Qty</th><th style="background:#667eea;color:white;padding:12px;text-align:right">Harga</th><th style="background:#667eea;color:white;padding:12px;text-align:right;border-radius:0 6px 0 0">Total</th></tr></thead><tbody>{{#items}}<tr><td style="padding:12px;border-bottom:1px solid #eee">{{description}}</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right">{{qty}}</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right">{{unitPrice}}</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right">{{total}}</td></tr>{{/items}}</tbody></table>
  <div style="text-align:right;font-size:22px;font-weight:bold;color:#667eea;padding:15px 0;border-top:2px solid #667eea">Total: {{currencySymbol}} {{grandTotal}}</div>
  <div style="margin-top:25px;padding:20px;background:#f8f9ff;border-radius:8px;border-left:4px solid #667eea"><strong>Info Pembayaran</strong><p style="margin:8px 0 0">Bank {{bankName}} | {{bankAccountNumber}} | a.n. {{bankAccountName}}</p></div>
</div>`,
  },
  {
    name: 'Minimal',
    htmlBody: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333">
  <div style="margin-bottom:40px"><h1 style="font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#999;margin:0">Invoice</h1><p style="font-size:32px;font-weight:300;margin:5px 0">#{{invoiceNumber}}</p></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:40px">
    <div><p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin:0 0 5px">Dari</p><p style="margin:0;font-weight:600">{{businessName}}</p><p style="margin:0;color:#666;font-size:14px">{{businessAddress}}</p></div>
    <div><p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin:0 0 5px">Kepada</p><p style="margin:0;font-weight:600">{{customerName}}</p><p style="margin:0;color:#666;font-size:14px">{{customerAddress}}</p></div>
    <div style="text-align:right"><p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin:0 0 5px">Tanggal</p><p style="margin:0">{{issueDate}}</p><p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin:10px 0 5px">Jatuh Tempo</p><p style="margin:0">{{dueDate}}</p></div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:30px"><thead><tr><th style="padding:10px 0;text-align:left;border-bottom:1px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">Item</th><th style="padding:10px 0;text-align:right;border-bottom:1px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">Qty</th><th style="padding:10px 0;text-align:right;border-bottom:1px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">Harga</th><th style="padding:10px 0;text-align:right;border-bottom:1px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999">Total</th></tr></thead><tbody>{{#items}}<tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0">{{description}}</td><td style="padding:12px 0;text-align:right;border-bottom:1px solid #f0f0f0">{{qty}}</td><td style="padding:12px 0;text-align:right;border-bottom:1px solid #f0f0f0">{{unitPrice}}</td><td style="padding:12px 0;text-align:right;border-bottom:1px solid #f0f0f0">{{total}}</td></tr>{{/items}}</tbody></table>
  <div style="text-align:right;padding:15px 0;border-top:2px solid #333"><span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-right:20px">Total</span><span style="font-size:24px;font-weight:300">{{currencySymbol}} {{grandTotal}}</span></div>
  <div style="margin-top:40px;font-size:13px;color:#999"><p>Bank: {{bankName}} | Rek: {{bankAccountNumber}} | a.n. {{bankAccountName}}</p></div>
</div>`,
  },
];

@Injectable()
export class InvoiceTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List all templates for a business (including seeded built-in ones)
   */
  async findAll(businessId: string) {
    let templates = await this.prisma.invoiceTemplate.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });

    // Auto-seed built-in templates if none exist
    if (templates.length === 0) {
      await this.seedDefaults(businessId);
      templates = await this.prisma.invoiceTemplate.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
      });
    }

    return templates;
  }

  /**
   * Get single template
   */
  async findOne(businessId: string, id: string) {
    const template = await this.prisma.invoiceTemplate.findFirst({
      where: { id, businessId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  /**
   * Create a custom template
   */
  async create(businessId: string, data: CreateInvoiceTemplateDto) {
    // If marking as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.invoiceTemplate.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.invoiceTemplate.create({
      data: {
        businessId,
        name: data.name,
        htmlBody: data.htmlBody,
        isDefault: data.isDefault || false,
      },
    });
  }

  /**
   * Update a template
   */
  async update(businessId: string, id: string, data: UpdateInvoiceTemplateDto) {
    const existing = await this.prisma.invoiceTemplate.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Template not found');

    if (data.isDefault) {
      await this.prisma.invoiceTemplate.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.invoiceTemplate.update({
      where: { id },
      data: {
        name: data.name,
        htmlBody: data.htmlBody,
        isDefault: data.isDefault,
      },
    });
  }

  /**
   * Delete a template
   */
  async remove(businessId: string, id: string) {
    const existing = await this.prisma.invoiceTemplate.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.invoiceTemplate.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Get the default template (or first available)
   */
  async getDefault(businessId: string) {
    const defaultTpl = await this.prisma.invoiceTemplate.findFirst({
      where: { businessId, isDefault: true },
    });
    if (defaultTpl) return defaultTpl;

    // Fallback to first template
    const first = await this.prisma.invoiceTemplate.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    return first;
  }

  /**
   * Seed built-in templates for new business
   */
  private async seedDefaults(businessId: string) {
    for (let i = 0; i < BUILT_IN_TEMPLATES.length; i++) {
      await this.prisma.invoiceTemplate.create({
        data: {
          businessId,
          name: BUILT_IN_TEMPLATES[i].name,
          htmlBody: BUILT_IN_TEMPLATES[i].htmlBody,
          isDefault: i === 0,
        },
      });
    }
  }
}
