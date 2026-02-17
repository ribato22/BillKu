import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  /**
   * PPN Tax Summary by period
   */
  async getTaxSummary(
    businessId: string,
    options: { from?: string; to?: string } = {},
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (options.from) dateFilter.gte = new Date(options.from);
    if (options.to) dateFilter.lte = new Date(options.to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Get all invoices with tax in the period
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        taxEnabled: true,
        ...(hasDateFilter && { issueDate: dateFilter }),
      },
      include: {
        customer: { select: { id: true, name: true, npwp: true } },
        items: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // Group by status for PPN reporting
    const ppnOutput = invoices.reduce((sum, inv) => sum + Number(inv.taxAmount), 0);

    // Group by month
    const monthlyPPN: Record<string, { count: number; taxAmount: number }> = {};
    invoices.forEach((inv) => {
      const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyPPN[key]) monthlyPPN[key] = { count: 0, taxAmount: 0 };
      monthlyPPN[key].count++;
      monthlyPPN[key].taxAmount += Number(inv.taxAmount);
    });

    // By customer
    const byCustomer: Record<string, { name: string; npwp: string | null; count: number; taxAmount: number }> = {};
    invoices.forEach((inv) => {
      const cid = inv.customer.id;
      if (!byCustomer[cid]) {
        byCustomer[cid] = { name: inv.customer.name, npwp: inv.customer.npwp, count: 0, taxAmount: 0 };
      }
      byCustomer[cid].count++;
      byCustomer[cid].taxAmount += Number(inv.taxAmount);
    });

    return {
      summary: {
        totalInvoices: invoices.length,
        ppnOutputTotal: ppnOutput,
        period: { from: options.from || null, to: options.to || null },
      },
      monthly: Object.entries(monthlyPPN)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data })),
      byCustomer: Object.values(byCustomer).sort((a, b) => b.taxAmount - a.taxAmount),
    };
  }

  /**
   * Generate e-Faktur CSV export in DJP import format
   * Format: FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,...
   */
  async generateEFakturCSV(
    businessId: string,
    options: { from?: string; to?: string } = {},
  ) {
    const dateFilter: Record<string, unknown> = {};
    if (options.from) dateFilter.gte = new Date(options.from);
    if (options.to) dateFilter.lte = new Date(options.to);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const business = await this.prisma.business.findFirst({
      where: { id: businessId },
    });

    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        taxEnabled: true,
        status: { in: ['sent', 'partial', 'paid'] },
        ...(hasDateFilter && { issueDate: dateFilter }),
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // Generate CSV lines
    const lines: string[] = [];

    invoices.forEach((inv, idx) => {
      const masaPajak = String(inv.issueDate.getMonth() + 1).padStart(2, '0');
      const tahunPajak = String(inv.issueDate.getFullYear());
      const tanggalFaktur = `${String(inv.issueDate.getDate()).padStart(2, '0')}/${masaPajak}/${tahunPajak}`;
      const npwpPembeli = inv.customer.npwp || '000000000000000';
      const namaPembeli = inv.customer.name.replace(/,/g, ' ');
      const alamatPembeli = (inv.customer.address || '-').replace(/,/g, ' ');
      const dpp = Number(inv.subtotal);
      const ppn = Number(inv.taxAmount);

      // FK line (Faktur header)
      lines.push([
        'FK',           // Record type
        '01',           // KD_JENIS_TRANSAKSI (01 = penyerahan BKP/JKP)
        '0',            // FG_PENGGANTI (0 = normal)
        '',             // NOMOR_FAKTUR (kosong, diisi DJP)
        masaPajak,      // MASA_PAJAK
        tahunPajak,     // TAHUN_PAJAK
        tanggalFaktur,  // TANGGAL_FAKTUR
        npwpPembeli,    // NPWP_PEMBELI
        namaPembeli,    // NAMA_PEMBELI
        alamatPembeli,  // ALAMAT_PEMBELI
        dpp,            // JUMLAH_DPP
        ppn,            // JUMLAH_PPN
        '0',            // JUMLAH_PPNBM
        '',             // ID_KETERANGAN_TAMBAHAN
        '0',            // FG_UANG_MUKA
        '0',            // UANG_MUKA_DPP
        '0',            // UANG_MUKA_PPN
        '0',            // UANG_MUKA_PPNBM
        inv.invoiceNumber, // REFERENSI
      ].join(','));

      // OF lines (Detail items per faktur)
      inv.items.forEach((item) => {
        const itemDPP = Number(item.unitPrice) * Number(item.qty);
        const itemPPN = Math.round(itemDPP * 0.11); // PPN 11%
        lines.push([
          'OF',                    // Record type
          '',                      // KODE_OBJEK
          item.description.replace(/,/g, ' '), // NAMA
          itemDPP,                 // HARGA_SATUAN
          Number(item.qty),        // JUMLAH_BARANG
          itemDPP,                 // HARGA_TOTAL
          '0',                     // DISKON
          itemDPP,                 // DPP
          itemPPN,                 // PPN
          '0',                     // TARIF_PPNBM
          '0',                     // PPNBM
        ].join(','));
      });
    });

    const csv = lines.join('\n');

    return {
      csv,
      invoiceCount: invoices.length,
      totalDPP: invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0),
      totalPPN: invoices.reduce((sum, inv) => sum + Number(inv.taxAmount), 0),
      period: { from: options.from || null, to: options.to || null },
    };
  }
}
