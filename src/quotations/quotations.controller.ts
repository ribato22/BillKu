import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';
import { InvoiceTemplatesService } from '../invoice-templates/invoice-templates.service';
import { PdfService } from '../pdf/pdf.service';

@Controller('quotations')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(
    private readonly quotationsService: QuotationsService,
    private readonly auditService: AuditService,
    private readonly invoiceTemplatesService: InvoiceTemplatesService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: string,
  ) {
    const data = await this.quotationsService.findAll(user.businessId, status);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.quotationsService.findOne(user.businessId, id);
    return { data };
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateQuotationDto,
  ) {
    const data = await this.quotationsService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'quotation',
      resourceId: data.id,
    });
    return { data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    const data = await this.quotationsService.update(user.businessId, id, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'quotation',
      resourceId: id,
      changes: dto as unknown as Record<string, unknown>,
    });
    return { data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.quotationsService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'quotation',
      resourceId: id,
    });
    return { data: { success: true } };
  }

  @Post(':id/convert')
  async convertToInvoice(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.quotationsService.convertToInvoice(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'convert-to-invoice',
      resource: 'quotation',
      resourceId: id,
    });
    return { data };
  }

  @Post(':id/send-email')
  async sendViaEmail(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const result = await this.quotationsService.sendViaEmail(user.businessId, id);
    return { data: result };
  }

  @Post(':id/send-whatsapp')
  async sendViaWhatsApp(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const result = await this.quotationsService.sendViaWhatsApp(user.businessId, id);
    return { data: result };
  }

  @Post(':id/send-both')
  async sendViaBoth(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const result = await this.quotationsService.sendViaBoth(user.businessId, id);
    return { data: result };
  }

  /**
   * GET /quotations/:id/pdf
   * Download quotation as PDF — uses custom template if available
   */
  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const quotation = await this.quotationsService.findOneForExport(user.businessId, id);

    let pdfBuffer: Buffer;
    let template: any = null;

    try {
      template = templateId
        ? await this.invoiceTemplatesService.findOne(user.businessId, templateId)
        : await this.invoiceTemplatesService.getDefault(user.businessId);
    } catch {
      // Template not found, will fallback
    }

    if (template?.htmlBody) {
      // Adapt the invoice template for quotation use
      let tplHtml = template.htmlBody
        .replace(/INVOICE/gi, 'PENAWARAN')
        .replace(/Invoice/g, 'Penawaran')
        .replace(/Jatuh Tempo/g, 'Berlaku Sampai');

      const variables = this.buildQuotationVariables(quotation);
      pdfBuffer = await this.pdfService.generateInvoicePdf(tplHtml, variables);
    } else {
      // Fallback to hardcoded quotation template
      const html = this.quotationsService.getQuotationHtml(quotation);
      pdfBuffer = await this.pdfService.generatePdf(html);
    }

    const number = quotation.quotationNumber || 'quotation';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="penawaran-${number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  /**
   * Build template variables from quotation data for mustache substitution
   */
  private buildQuotationVariables(quotation: any): Record<string, string> {
    const formatCurrency = (amount: number) =>
      amount.toLocaleString('id-ID');

    const formatDate = (date: Date) =>
      new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const items = (quotation.items || []).map((item: any) => ({
      description: item.description || item.product?.name || '',
      qty: String(Number(item.qty)),
      unitPrice: `Rp ${formatCurrency(Number(item.unitPrice))}`,
      total: `Rp ${formatCurrency(Number(item.unitPrice) * Number(item.qty))}`,
    }));

    const grandTotal = (quotation.items || []).reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * Number(item.qty), 0,
    );

    return {
      businessName: quotation.business?.name || '',
      businessAddress: quotation.business?.address || '',
      businessPhone: quotation.business?.phone || '',
      businessEmail: quotation.business?.email || '',
      invoiceNumber: quotation.quotationNumber || '',
      issueDate: formatDate(quotation.issueDate),
      dueDate: quotation.validUntil ? formatDate(quotation.validUntil) : '',
      customerName: quotation.customer?.name || '',
      customerAddress: quotation.customer?.address || '',
      customerEmail: quotation.customer?.email || '',
      currencySymbol: 'Rp',
      subtotal: formatCurrency(grandTotal),
      taxAmount: '0',
      discount: '0',
      grandTotal: formatCurrency(grandTotal),
      bankName: quotation.business?.bankName || '',
      bankAccountNumber: quotation.business?.bankAccountNumber || '',
      bankAccountName: quotation.business?.bankAccountName || '',
      __items_json: JSON.stringify(items),
    };
  }
}
