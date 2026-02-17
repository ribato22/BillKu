import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host || !user) {
        this.logger.warn('SMTP not configured — emails will be logged only');
        // Create a preview-only transporter using Ethereal
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
        return this.transporter;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.transporter;
  }

  /**
   * Send an email with html content and optional attachments
   */
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string }> {
    try {
      const transport = this.getTransporter();
      const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@billku.id';

      const info = await transport.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      // If using jsonTransport (no SMTP), log the email
      if (!process.env.SMTP_HOST) {
        this.logger.log(`📧 Email logged (no SMTP): To=${options.to} Subject="${options.subject}"`);
      } else {
        this.logger.log(`📧 Email sent: ${info.messageId}`);
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      return { success: false };
    }
  }

  /**
   * Send an email using explicit SMTP config (from DB)
   */
  async sendWithConfig(
    options: EmailOptions,
    config: { host: string; port: number; user: string; pass: string; from: string },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });

      const info = await transport.sendMail({
        from: config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      this.logger.log(`📧 Email sent via DB config: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`Failed to send email (DB config) to ${options.to}:`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
    }
  }

  /**
   * Send invoice email with PDF attachment
   */
  async sendInvoiceEmail(params: {
    to: string;
    businessName: string;
    customerName: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    pdfBuffer?: Buffer;
    paymentLink?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const html = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">${params.businessName}</h1>
          <p style="opacity:0.8;margin:5px 0 0">Invoice Baru</p>
        </div>
        <div style="padding:30px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p>Halo <strong>${params.customerName}</strong>,</p>
          <p>Berikut adalah invoice dari <strong>${params.businessName}</strong>:</p>
          <div style="background:#f8f9ff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #667eea">
            <p style="margin:0"><strong>No. Invoice:</strong> ${params.invoiceNumber}</p>
            <p style="margin:8px 0 0"><strong>Total:</strong> ${params.amount}</p>
            <p style="margin:8px 0 0"><strong>Jatuh Tempo:</strong> ${params.dueDate}</p>
          </div>
          ${params.paymentLink ? `
          <div style="text-align:center;margin:25px 0">
            <a href="${params.paymentLink}" style="background:#667eea;color:white;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
              Bayar Sekarang
            </a>
          </div>` : ''}
          <p style="color:#666;font-size:14px;margin-top:20px">
            ${params.pdfBuffer ? 'Invoice terlampir dalam format PDF.' : 'Silakan hubungi kami jika ada pertanyaan.'}
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="color:#999;font-size:12px;text-align:center">Dikirim melalui BillKu</p>
        </div>
      </div>
    `;

    const attachments = params.pdfBuffer
      ? [{ filename: `Invoice-${params.invoiceNumber}.pdf`, content: params.pdfBuffer, contentType: 'application/pdf' }]
      : [];

    return this.send({
      to: params.to,
      subject: `Invoice ${params.invoiceNumber} dari ${params.businessName}`,
      html,
      attachments,
    });
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceiptEmail(params: {
    to: string;
    businessName: string;
    customerName: string;
    invoiceNumber: string;
    amountPaid: string;
    paymentDate: string;
    paymentMethod: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const html = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);color:white;padding:30px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">${params.businessName}</h1>
          <p style="opacity:0.8;margin:5px 0 0">Konfirmasi Pembayaran</p>
        </div>
        <div style="padding:30px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p>Halo <strong>${params.customerName}</strong>,</p>
          <p>Pembayaran Anda telah kami terima. Terima kasih!</p>
          <div style="background:#f0fff4;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #38ef7d">
            <p style="margin:0"><strong>No. Invoice:</strong> ${params.invoiceNumber}</p>
            <p style="margin:8px 0 0"><strong>Jumlah:</strong> ${params.amountPaid}</p>
            <p style="margin:8px 0 0"><strong>Tanggal:</strong> ${params.paymentDate}</p>
            <p style="margin:8px 0 0"><strong>Metode:</strong> ${params.paymentMethod}</p>
          </div>
          <div style="text-align:center;margin:20px 0">
            <span style="font-size:48px">✅</span>
            <p style="color:#38ef7d;font-weight:bold;font-size:16px">LUNAS</p>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="color:#999;font-size:12px;text-align:center">Dikirim melalui BillKu</p>
        </div>
      </div>
    `;

    return this.send({
      to: params.to,
      subject: `Pembayaran Diterima - Invoice ${params.invoiceNumber}`,
      html,
    });
  }

  /**
   * Send overdue reminder email
   */
  async sendOverdueReminderEmail(params: {
    to: string;
    businessName: string;
    customerName: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    daysOverdue: number;
    paymentLink?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    const html = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#f5222d 0%,#ff6b6b 100%);color:white;padding:30px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">${params.businessName}</h1>
          <p style="opacity:0.8;margin:5px 0 0">Pengingat Pembayaran</p>
        </div>
        <div style="padding:30px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p>Halo <strong>${params.customerName}</strong>,</p>
          <p>Invoice berikut telah melewati jatuh tempo selama <strong>${params.daysOverdue} hari</strong>:</p>
          <div style="background:#fff2f0;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #f5222d">
            <p style="margin:0"><strong>No. Invoice:</strong> ${params.invoiceNumber}</p>
            <p style="margin:8px 0 0"><strong>Total:</strong> ${params.amount}</p>
            <p style="margin:8px 0 0"><strong>Jatuh Tempo:</strong> ${params.dueDate}</p>
            <p style="margin:8px 0 0;color:#f5222d"><strong>Keterlambatan:</strong> ${params.daysOverdue} hari</p>
          </div>
          ${params.paymentLink ? `
          <div style="text-align:center;margin:25px 0">
            <a href="${params.paymentLink}" style="background:#f5222d;color:white;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
              Bayar Sekarang
            </a>
          </div>` : ''}
          <p style="color:#666;font-size:14px">Mohon segera lakukan pembayaran. Abaikan pesan ini jika sudah melakukan pembayaran.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <p style="color:#999;font-size:12px;text-align:center">Dikirim melalui BillKu</p>
        </div>
      </div>
    `;

    return this.send({
      to: params.to,
      subject: `⚠️ Pengingat: Invoice ${params.invoiceNumber} - ${params.daysOverdue} hari lewat jatuh tempo`,
      html,
    });
  }
}
