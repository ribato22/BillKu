import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto';
import { PdfService } from '../pdf/pdf.service';
import { EmailService } from '../email/email.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private emailService: EmailService,
    private whatsAppService: WhatsAppService,
  ) {}

  /**
   * Generate next quotation number: QUO-YYYYMM-XXXX
   */
  private async generateNumber(businessId: string): Promise<string> {
    const now = new Date();
    const prefix = `QUO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const lastQuotation = await this.prisma.quotation.findFirst({
      where: {
        businessId,
        quotationNumber: { startsWith: prefix },
      },
      orderBy: { quotationNumber: 'desc' },
    });

    let seq = 1;
    if (lastQuotation) {
      const parts = lastQuotation.quotationNumber.split('-');
      seq = parseInt(parts[2] || '0', 10) + 1;
    }

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  async findAll(businessId: string, status?: string) {
    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;

    const quotations = await this.prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return quotations.map((q) => this.serializeQuotation(q));
  }

  async findOne(businessId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');
    return this.serializeQuotation(quotation);
  }

  /**
   * Get quotation with business info for export (PDF)
   */
  async findOneForExport(businessId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, businessId },
      include: {
        business: true,
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  /**
   * Public accessor for generating quotation HTML (used by controller fallback)
   */
  getQuotationHtml(quotation: any): string {
    return this.generateQuotationHtml(quotation);
  }

  async create(businessId: string, dto: CreateQuotationDto) {
    const quotationNumber = await this.generateNumber(businessId);

    const result = await this.prisma.quotation.create({
      data: {
        businessId,
        customerId: dto.customerId,
        quotationNumber,
        issueDate: new Date(dto.issueDate),
        validUntil: new Date(dto.validUntil),
        notes: dto.notes,
        currencyCode: dto.currencyCode || 'IDR',
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId || null,
            description: item.description,
            qty: item.qty,
            unitPrice: BigInt(item.unitPrice),
          })),
        },
      },
      include: { items: true, customer: true },
    });

    return this.serializeQuotation(result);
  }

  async update(businessId: string, id: string, dto: UpdateQuotationDto) {
    const existing = await this.findOne(businessId, id);
    if (!existing) throw new NotFoundException('Quotation not found');

    const result = await this.prisma.$transaction(async (tx) => {
      // If items provided, replace them
      if (dto.items) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({
          data: dto.items.map((item) => ({
            quotationId: id,
            productId: item.productId || null,
            description: item.description,
            qty: item.qty,
            unitPrice: BigInt(item.unitPrice),
          })),
        });
      }

      return tx.quotation.update({
        where: { id },
        data: {
          ...(dto.customerId && { customerId: dto.customerId }),
          ...(dto.issueDate && { issueDate: new Date(dto.issueDate) }),
          ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.status && { status: dto.status as 'draft' | 'sent' | 'accepted' | 'rejected' }),
        },
        include: { items: true, customer: true },
      });
    });

    return this.serializeQuotation(result);
  }

  async remove(businessId: string, id: string) {
    const existing = await this.findOne(businessId, id);
    if (!existing) throw new NotFoundException('Quotation not found');

    return this.prisma.quotation.delete({ where: { id } });
  }

  /**
   * Send quotation via email with PDF attachment
   */
  async sendViaEmail(businessId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
        business: true,
      },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');
    if (!quotation.customer.email) {
      throw new NotFoundException('Pelanggan belum memiliki email');
    }

    // Generate PDF
    const pdfHtml = this.generateQuotationHtml(quotation);
    const pdfBuffer = await this.pdfService.generatePdf(pdfHtml);

    // Calculate total
    const total = quotation.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * Number(item.qty),
      0,
    );

    // Send email with PDF attachment
    const result = await this.emailService.send({
      to: quotation.customer.email,
      subject: `Penawaran ${quotation.quotationNumber} — ${quotation.business.name}`,
      html: this.generateEmailHtml(quotation, total),
      attachments: [
        {
          filename: `${quotation.quotationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update status to sent
    if (result.success) {
      await this.prisma.quotation.update({
        where: { id },
        data: { status: 'sent' },
      });
    }

    return { success: result.success, messageId: result.messageId };
  }

  /**
   * Send quotation via WhatsApp
   */
  async sendViaWhatsApp(businessId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
        business: true,
      },
    });

    if (!quotation) throw new NotFoundException('Quotation not found');
    if (!quotation.customer.phone) {
      throw new NotFoundException('Pelanggan belum memiliki nomor telepon');
    }

    // Build WhatsApp caption message
    const total = quotation.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * Number(item.qty),
      0,
    );

    const caption =
      `*Penawaran ${quotation.quotationNumber}*\n\n` +
      `Yth. ${quotation.customer.name},\n\n` +
      `Berikut penawaran dari ${quotation.business.name}:\n\n` +
      quotation.items
        .map(
          (item, i) =>
            `${i + 1}. ${item.description}\n   ${Number(item.qty)} x Rp ${Number(item.unitPrice).toLocaleString('id-ID')} = *Rp ${(Number(item.qty) * Number(item.unitPrice)).toLocaleString('id-ID')}*`,
        )
        .join('\n\n') +
      `\n\n*Total: Rp ${total.toLocaleString('id-ID')}*\n` +
      `Berlaku s/d: ${quotation.validUntil.toLocaleDateString('id-ID')}\n` +
      (quotation.notes ? `\nCatatan: ${quotation.notes}\n` : '') +
      `\nMohon konfirmasi persetujuan Anda. Terima kasih! 🙏`;

    let result: { success: boolean; error?: string };

    // Try to generate PDF and send as document
    try {
      const pdfHtml = this.generateQuotationHtml(quotation);
      const pdfBuffer = await this.pdfService.generatePdf(pdfHtml);

      result = await this.whatsAppService.sendDocument(
        businessId,
        quotation.customer.phone,
        pdfBuffer,
        `${quotation.quotationNumber}.pdf`,
        caption,
      );
    } catch (pdfError) {
      // Fallback: send text-only if PDF generation fails
      this.logger.warn(`PDF generation failed, sending text-only: ${pdfError.message}`);
      result = await this.whatsAppService.sendMessage(
        businessId,
        quotation.customer.phone,
        caption,
      );
    }

    // Only update status to sent if the message was actually delivered
    if (result.success) {
      await this.prisma.quotation.update({
        where: { id },
        data: { status: 'sent' },
      });
    }

    return {
      ...result,
      statusUpdated: true,
    };
  }


  /**
   * Send quotation via both Email and WhatsApp
   */
  async sendViaBoth(businessId: string, id: string) {
    const results = { email: { success: false, error: '' }, whatsapp: { success: false, error: '' } };

    // Send email
    try {
      const emailResult = await this.sendViaEmail(businessId, id);
      results.email = { success: emailResult.success, error: '' };
    } catch (error) {
      results.email = { success: false, error: error instanceof Error ? error.message : 'Email gagal' };
    }

    // Send WhatsApp
    try {
      const waResult = await this.sendViaWhatsApp(businessId, id);
      results.whatsapp = { success: waResult.success, error: waResult.error || '' };
    } catch (error) {
      results.whatsapp = { success: false, error: error instanceof Error ? error.message : 'WhatsApp gagal' };
    }

    // Status already updated by individual methods
    return results;
  }

  /**
   * Convert quotation to invoice
   */
  async convertToInvoice(businessId: string, id: string) {
    const quotation = await this.findOne(businessId, id);

    if (quotation.status === 'converted') {
      throw new NotFoundException('Quotation already converted');
    }

    // Get next invoice number
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { businessId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });
    let seq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      seq = parseInt(parts[2] || '0', 10) + 1;
    }
    const invoiceNumber = `${prefix}-${String(seq).padStart(4, '0')}`;

    // Create invoice from quotation data
    const result = await this.prisma.$transaction(async (tx) => {
      // Generate a unique public ID for the invoice
      const publicId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

      // Calculate subtotal and total from quotation items
      const subtotal = quotation.items.reduce(
        (sum: number, item: any) => sum + Math.round(Number(item.qty) * Number(item.unitPrice)),
        0,
      );
      const total = subtotal; // No discount or tax from quotation conversion

      const invoice = await tx.invoice.create({
        data: {
          businessId,
          customerId: quotation.customerId,
          invoiceNumber,
          publicId,
          status: 'draft',
          issueDate: now,
          dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
          currencyCode: quotation.currencyCode,
          currencyMinorUnit: 0,
          subtotal: BigInt(subtotal),
          total: BigInt(total),
          items: {
            create: quotation.items.map((item: any) => ({
              productId: item.productId,
              description: item.description,
              qty: item.qty,
              unitPrice: BigInt(item.unitPrice),
              total: BigInt(Math.round(Number(item.qty) * Number(item.unitPrice))),
            })),
          },
        },
        include: { items: true },
      });

      // Mark quotation as converted
      await tx.quotation.update({
        where: { id },
        data: {
          status: 'converted',
          convertedInvoiceId: invoice.id,
        },
      });

      return invoice;
    });

    return result;
  }

  /**
   * Serialize quotation to convert BigInt fields to Numbers
   */
  private serializeQuotation(quotation: any) {
    return {
      ...quotation,
      items: quotation.items?.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        product: item.product
          ? {
              ...item.product,
              price: Number(item.product.price),
            }
          : undefined,
      })),
    };
  }

  /**
   * Generate HTML for quotation PDF
   */
  private generateQuotationHtml(quotation: any): string {
    const total = quotation.items.reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * item.qty,
      0,
    );

    const itemRows = quotation.items
      .map(
        (item: any, i: number) => `
          <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px">${i + 1}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;font-weight:500">${item.description}</td>
            <td style="padding:12px 16px;text-align:center;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px">${item.qty}</td>
            <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px">Rp ${Number(item.unitPrice).toLocaleString('id-ID')}</td>
            <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:13px;font-weight:600">Rp ${(item.qty * Number(item.unitPrice)).toLocaleString('id-ID')}</td>
          </tr>`,
      )
      .join('');

    const issueDate = quotation.issueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const validDate = quotation.validUntil.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    return `
      <div style="font-family:'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:800px;margin:0 auto;background:#ffffff">
        <!-- Header with gradient accent -->
        <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px 40px;color:#ffffff">
          <table style="width:100%"><tr>
            <td style="vertical-align:top">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;opacity:0.85;margin-bottom:4px;color:#ffffff">Penawaran Harga</div>
              <div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#ffffff">${quotation.quotationNumber}</div>
            </td>
            <td style="text-align:right;vertical-align:top">
              <div style="font-size:20px;font-weight:700;color:#ffffff">${quotation.business.name}</div>
              ${quotation.business.address ? `<div style="font-size:12px;opacity:0.85;margin-top:4px;color:#ffffff">${quotation.business.address}</div>` : ''}
            </td>
          </tr></table>
        </div>

        <div style="padding:32px 40px">
          <!-- Customer & Date info -->
          <table style="width:100%;margin-bottom:32px"><tr>
            <td style="vertical-align:top;width:60%">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:8px">Ditujukan Kepada</div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px">${quotation.customer.name}</div>
              ${quotation.customer.email ? `<div style="font-size:13px;color:#64748b;margin-bottom:2px">${quotation.customer.email}</div>` : ''}
              ${quotation.customer.phone ? `<div style="font-size:13px;color:#64748b;margin-bottom:2px">${quotation.customer.phone}</div>` : ''}
              ${quotation.customer.address ? `<div style="font-size:13px;color:#64748b;line-height:1.4">${quotation.customer.address}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right">
              <table style="margin-left:auto">
                <tr>
                  <td style="padding:4px 12px 4px 0;font-size:12px;color:#94a3b8;text-align:right">Tanggal</td>
                  <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600">${issueDate}</td>
                </tr>
                <tr>
                  <td style="padding:4px 12px 4px 0;font-size:12px;color:#94a3b8;text-align:right">Berlaku s/d</td>
                  <td style="padding:4px 0;font-size:13px;color:#0f172a;font-weight:600">${validDate}</td>
                </tr>
              </table>
            </td>
          </tr></table>

          <!-- Items Table -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead>
              <tr>
                <th style="padding:14px 16px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #1e40af;background:#f1f5f9;width:50px">No</th>
                <th style="padding:14px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #1e40af;background:#f1f5f9">Deskripsi</th>
                <th style="padding:14px 16px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #1e40af;background:#f1f5f9;width:60px">Qty</th>
                <th style="padding:14px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #1e40af;background:#f1f5f9;width:150px">Harga Satuan</th>
                <th style="padding:14px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;border-bottom:2px solid #1e40af;background:#f1f5f9;width:150px">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <!-- Total Section -->
          <table style="width:100%;margin-bottom:32px"><tr>
            <td style="width:60%"></td>
            <td>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:16px 20px;text-align:right;font-size:14px;font-weight:600;color:#475569;background:#f1f5f9;border-radius:8px 0 0 8px">Total</td>
                  <td style="padding:16px 20px;text-align:right;font-size:18px;font-weight:800;color:#1e40af;background:#f1f5f9;border-radius:0 8px 8px 0;white-space:nowrap">Rp ${total.toLocaleString('id-ID')}</td>
                </tr>
              </table>
            </td>
          </tr></table>

          ${quotation.notes ? `
          <!-- Notes -->
          <div style="margin-bottom:32px;padding:16px 20px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;margin-bottom:6px">Catatan</div>
            <div style="font-size:13px;color:#334155;line-height:1.6">${quotation.notes}</div>
          </div>` : ''}

          <!-- Terms -->
          <div style="margin-bottom:32px;padding:20px;border:1px solid #e2e8f0;border-radius:8px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;margin-bottom:8px">Syarat & Ketentuan</div>
            <div style="font-size:12px;color:#64748b;line-height:1.6">
              1. Harga sudah termasuk pajak kecuali disebutkan lain.<br>
              2. Penawaran ini berlaku sampai tanggal yang tertera di atas.<br>
              3. Pembayaran sesuai kesepakatan bersama.
            </div>
          </div>

          <!-- Signature Area -->
          <table style="width:100%;margin-top:20px"><tr>
            <td style="width:50%"></td>
            <td style="text-align:center;padding:20px">
              <div style="font-size:13px;color:#475569;margin-bottom:60px">Hormat kami,</div>
              <div style="font-size:14px;font-weight:700;color:#0f172a">${quotation.business.name}</div>
            </td>
          </tr></table>
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center">
          <div style="font-size:10px;color:#94a3b8;letter-spacing:0.5px">Dokumen ini dibuat secara otomatis oleh BillKu • ${quotation.quotationNumber}</div>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML email body
   */
  private generateEmailHtml(quotation: any, total: number): string {
    return `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2563eb">Penawaran ${quotation.quotationNumber}</h2>
        <p>Yth. ${quotation.customer.name},</p>
        <p>Terima kasih atas kepercayaan Anda. Berikut kami lampirkan penawaran dari <strong>${quotation.business.name}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#f1f5f9">
            <td style="padding:10px;border:1px solid #ddd"><strong>No. Penawaran</strong></td>
            <td style="padding:10px;border:1px solid #ddd">${quotation.quotationNumber}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd"><strong>Total</strong></td>
            <td style="padding:10px;border:1px solid #ddd;color:#2563eb;font-weight:bold">Rp ${total.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:10px;border:1px solid #ddd"><strong>Berlaku s/d</strong></td>
            <td style="padding:10px;border:1px solid #ddd">${quotation.validUntil.toLocaleDateString('id-ID')}</td>
          </tr>
        </table>
        <p>Detail penawaran dapat dilihat pada file PDF terlampir.</p>
        <p>Mohon konfirmasi persetujuan Anda.</p>
        <p style="margin-top:30px">Terima kasih,<br><strong>${quotation.business.name}</strong></p>
      </div>
    `;
  }
}
