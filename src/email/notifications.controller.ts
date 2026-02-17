import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { IsString, IsOptional } from 'class-validator';

class SendInvoiceEmailDto {
  @IsString()
  invoiceId!: string;

  @IsOptional()
  @IsString()
  emailOverride?: string; // Manually override recipient email
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /notifications/send-invoice
   * Send invoice via email with PDF attachment
   */
  @Post('send-invoice')
  async sendInvoiceEmail(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SendInvoiceEmailDto,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, businessId: user.businessId },
      include: {
        customer: true,
        items: true,
        business: { include: { defaultCurrency: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const recipientEmail = dto.emailOverride || invoice.customer.email;
    if (!recipientEmail) {
      return { success: false, error: 'Customer has no email address' };
    }

    const currencySymbol = invoice.business.defaultCurrency?.symbol || 'Rp';
    const grandTotal = invoice.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * Number(item.qty),
      0,
    );

    // Try to generate PDF
    let pdfBuffer: Buffer | undefined;
    try {
      // Check if business has a template
      const template = await this.prisma.invoiceTemplate.findFirst({
        where: { businessId: user.businessId, isDefault: true },
      });

      if (template) {
        const variables: Record<string, string> = {
          businessName: invoice.business.name,
          businessAddress: invoice.business.address || '',
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customer.name,
          customerAddress: invoice.customer.address || '',
          issueDate: invoice.issueDate.toLocaleDateString('id-ID'),
          dueDate: invoice.dueDate.toLocaleDateString('id-ID'),
          currencySymbol,
          grandTotal: grandTotal.toLocaleString('id-ID'),
          bankName: invoice.business.bankName || '',
          bankAccountNumber: invoice.business.bankAccountNumber || '',
          bankAccountName: invoice.business.bankAccountName || '',
          __items_json: JSON.stringify(
            invoice.items.map((item) => ({
              description: item.description,
              qty: Number(item.qty),
              unitPrice: Number(item.unitPrice).toLocaleString('id-ID'),
              total: (Number(item.unitPrice) * Number(item.qty)).toLocaleString('id-ID'),
            })),
          ),
        };
        pdfBuffer = await this.pdfService.generateInvoicePdf(template.htmlBody, variables);
      }
    } catch {
      // PDF generation failed, send without attachment
    }

    const result = await this.emailService.sendInvoiceEmail({
      to: recipientEmail,
      businessName: invoice.business.name,
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: `${currencySymbol} ${grandTotal.toLocaleString('id-ID')}`,
      dueDate: invoice.dueDate.toLocaleDateString('id-ID'),
      pdfBuffer,
    });

    return { data: result };
  }

  /**
   * POST /notifications/send-reminder/:invoiceId
   * Send overdue reminder for an invoice
   */
  @Post('send-reminder/:invoiceId')
  async sendReminder(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId: user.businessId },
      include: {
        customer: true,
        items: true,
        business: { include: { defaultCurrency: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (!invoice.customer.email) {
      return { success: false, error: 'Customer has no email address' };
    }

    const currencySymbol = invoice.business.defaultCurrency?.symbol || 'Rp';
    const grandTotal = invoice.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * Number(item.qty),
      0,
    );
    const daysOverdue = Math.floor(
      (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const result = await this.emailService.sendOverdueReminderEmail({
      to: invoice.customer.email,
      businessName: invoice.business.name,
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: `${currencySymbol} ${grandTotal.toLocaleString('id-ID')}`,
      dueDate: invoice.dueDate.toLocaleDateString('id-ID'),
      daysOverdue: Math.max(daysOverdue, 0),
    });

    return { data: result };
  }
}
