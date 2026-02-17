import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceTemplateService } from './invoice-template.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceTemplatesService } from '../invoice-templates/invoice-templates.service';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData, Public } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceTemplateService: InvoiceTemplateService,
    private readonly invoiceTemplatesService: InvoiceTemplatesService,
    private readonly pdfService: PdfService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /invoices/export/efaktur
   * Export invoices in DJP E-Faktur compatible CSV format
   */
  @Get('export/efaktur')
  async exportEfaktur(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId: user.businessId,
        taxEnabled: true,
        status: { in: ['sent', 'partial', 'paid'] },
        ...(Object.keys(dateFilter).length > 0 ? { issueDate: dateFilter } : {}),
      },
      include: {
        customer: true,
        items: true,
        business: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // E-Faktur CSV header
    const headers = [
      'FK', 'KD_JENIS_TRANSAKSI', 'FG_PENGGANTI', 'NOMOR_FAKTUR', 'MASA_PAJAK',
      'TAHUN_PAJAK', 'TANGGAL_FAKTUR', 'NPWP', 'NAMA', 'ALAMAT_LENGKAP',
      'JUMLAH_DPP', 'JUMLAH_PPN', 'JUMLAH_PPNBM', 'ID_KETERANGAN_TAMBAHAN',
      'FG_UANG_MUKA', 'UANG_MUKA_DPP', 'UANG_MUKA_PPN', 'UANG_MUKA_PPNBM',
      'REFERENSI',
    ];

    const rows = invoices.map((inv) => {
      const dpp = inv.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * Number(item.qty),
        0,
      );
      const ppn = Number(inv.taxAmount || 0);
      const issueDate = inv.issueDate;
      const month = String(issueDate.getMonth() + 1).padStart(2, '0');
      const year = String(issueDate.getFullYear());
      const dateStr = `${String(issueDate.getDate()).padStart(2, '0')}/${month}/${year}`;

      return [
        'FK',                           // FK marker
        '01',                           // KD_JENIS_TRANSAKSI (01 = to domestic customer)
        '0',                            // FG_PENGGANTI (0 = original)
        inv.invoiceNumber,              // NOMOR_FAKTUR
        month,                          // MASA_PAJAK
        year,                           // TAHUN_PAJAK
        dateStr,                        // TANGGAL_FAKTUR
        inv.customer.npwp || '',        // NPWP
        inv.customer.name,              // NAMA
        inv.customer.address || '',     // ALAMAT_LENGKAP
        String(dpp),                    // JUMLAH_DPP
        String(ppn),                    // JUMLAH_PPN
        '0',                           // JUMLAH_PPNBM
        '',                            // ID_KETERANGAN_TAMBAHAN
        '0',                           // FG_UANG_MUKA
        '0',                           // UANG_MUKA_DPP
        '0',                           // UANG_MUKA_PPN
        '0',                           // UANG_MUKA_PPNBM
        inv.invoiceNumber,             // REFERENSI
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    if (res) {
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="efaktur-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      });
      res.send(csv);
    }
  }

  /**
   * GET /invoices
   * List invoices with pagination
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string | string[],
    @Query('customerId') customerId?: string,
  ) {
    return this.invoicesService.findAll(user.businessId, {
      page,
      pageSize,
      status,
      customerId,
    });
  }

  /**
   * GET /invoices/:id
   * Get invoice details
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const invoice = await this.invoicesService.findOne(user.businessId, id);
    return { data: invoice };
  }

  /**
   * GET /invoices/:id/pdf
   * Download invoice as PDF — uses the user's custom template if available
   */
  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOneForExport(user.businessId, id);

    // Try to get the user's custom template
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
      // Use custom template with variable substitution
      const variables = this.buildInvoiceVariables(invoice);
      pdfBuffer = await this.pdfService.generateInvoicePdf(template.htmlBody, variables);
    } else {
      // Fallback to hardcoded template
      const html = this.invoiceTemplateService.generateHtml(invoice as any);
      pdfBuffer = await this.pdfService.generatePdf(html);
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  /**
   * Build template variables from invoice data for mustache substitution
   */
  private buildInvoiceVariables(invoice: any): Record<string, string> {
    const formatCurrency = (amount: number) =>
      amount.toLocaleString('id-ID');

    const formatDate = (date: Date) =>
      new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const items = (invoice.items || []).map((item: any) => ({
      description: item.description || item.product?.name || '',
      qty: String(Number(item.qty)),
      unitPrice: `${invoice.currency?.symbol || 'Rp'} ${formatCurrency(Number(item.unitPrice))}`,
      total: `${invoice.currency?.symbol || 'Rp'} ${formatCurrency(Number(item.unitPrice) * Number(item.qty))}`,
    }));

    const subtotal = (invoice.items || []).reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * Number(item.qty), 0,
    );

    return {
      businessName: invoice.business?.name || '',
      businessAddress: invoice.business?.address || '',
      businessPhone: invoice.business?.phone || '',
      businessEmail: invoice.business?.email || '',
      invoiceNumber: invoice.invoiceNumber,
      issueDate: formatDate(invoice.issueDate),
      dueDate: formatDate(invoice.dueDate),
      customerName: invoice.customer?.name || '',
      customerAddress: invoice.customer?.address || '',
      customerEmail: invoice.customer?.email || '',
      currencySymbol: invoice.currency?.symbol || 'Rp',
      subtotal: formatCurrency(subtotal),
      taxAmount: formatCurrency(Number(invoice.taxAmount || 0)),
      discount: formatCurrency(Number(invoice.discount || 0)),
      grandTotal: formatCurrency(Number(invoice.total || subtotal)),
      bankName: invoice.business?.bankName || '',
      bankAccountNumber: invoice.business?.bankAccountNumber || '',
      bankAccountName: invoice.business?.bankAccountName || '',
      __items_json: JSON.stringify(items),
    };
  }

  /**
   * GET /invoices/:id/csv
   * Download invoice as CSV
   */
  @Get(':id/csv')
  async downloadCsv(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOneForExport(user.businessId, id);
    const csv = this.invoiceTemplateService.generateCsv(invoice as any);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.csv"`,
    });

    res.send(csv);
  }

  /**
   * POST /invoices
   * Create a new invoice
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateInvoiceDto,
  ) {
    const invoice = await this.invoicesService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'invoice',
      resourceId: invoice.id,
      changes: { customerId: dto.customerId, items: dto.items?.length },
    });
    return { data: invoice };
  }

  /**
   * PATCH /invoices/:id
   * Update invoice (draft only)
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const invoice = await this.invoicesService.update(user.businessId, id, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'invoice',
      resourceId: id,
      changes: dto as unknown as Record<string, unknown>,
    });
    return { data: invoice };
  }

  /**
   * PATCH /invoices/:id/status
   * Update invoice status
   */
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    const invoice = await this.invoicesService.updateStatus(
      user.businessId,
      id,
      dto.status,
    );
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'invoice',
      resourceId: id,
      changes: { status: dto.status },
    });
    return { data: invoice };
  }

  /**
   * DELETE /invoices/:id
   * Delete invoice (draft only)
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.invoicesService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'invoice',
      resourceId: id,
    });
    return { data: { success: true } };
  }

  /**
   * GET /invoices/public/:publicId
   * Get invoice by public ID (no auth required)
   */
  @Public()
  @Get('public/:publicId')
  async findByPublicId(@Param('publicId') publicId: string) {
    const invoice = await this.invoicesService.findByPublicId(publicId);
    return { data: invoice };
  }
}

