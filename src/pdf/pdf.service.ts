import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;

  async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  /**
   * Generate PDF from raw HTML string
   */
  async generatePdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate invoice PDF using a template with variable substitution
   */
  async generateInvoicePdf(template: string, variables: Record<string, string>): Promise<Buffer> {
    let html = template;

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Handle {{#items}}...{{/items}} block (repeating items)
    const itemsMatch = html.match(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/);
    if (itemsMatch && variables['__items_json']) {
      try {
        const items = JSON.parse(variables['__items_json']);
        const itemTemplate = itemsMatch[1];
        const renderedItems = items
          .map((item: Record<string, string>) => {
            let row = itemTemplate;
            for (const [k, v] of Object.entries(item)) {
              row = row.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            }
            return row;
          })
          .join('');
        html = html.replace(itemsMatch[0], renderedItems);
      } catch (e) {
        this.logger.warn('Failed to parse items JSON for template rendering', e);
      }
    }

    return this.generatePdf(html);
  }

  /**
   * Generate a delivery note PDF
   */
  async generateDeliveryNotePdf(data: {
    noteNumber: string;
    deliveryDate: string;
    recipient: string;
    address: string;
    businessName: string;
    invoiceNumber?: string;
    items: { description: string; qty: number; unit: string }[];
  }): Promise<Buffer> {
    const itemRows = data.items
      .map(
        (item, i) =>
          `<tr><td style="border:1px solid #ddd;padding:8px;text-align:center">${i + 1}</td>
           <td style="border:1px solid #ddd;padding:8px">${item.description}</td>
           <td style="border:1px solid #ddd;padding:8px;text-align:center">${item.qty}</td>
           <td style="border:1px solid #ddd;padding:8px;text-align:center">${item.unit}</td></tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:20px">
          <div><h1 style="margin:0;font-size:22px">${data.businessName}</h1></div>
          <div style="text-align:right">
            <h2 style="margin:0;color:#333">SURAT JALAN</h2>
            <p style="margin:5px 0">#${data.noteNumber}</p>
            <p style="margin:5px 0">Tanggal: ${data.deliveryDate}</p>
            ${data.invoiceNumber ? `<p style="margin:5px 0">Ref Invoice: ${data.invoiceNumber}</p>` : ''}
          </div>
        </div>
        <div style="margin-bottom:20px">
          <strong>Penerima:</strong> ${data.recipient}<br>
          <strong>Alamat:</strong> ${data.address}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px">
          <thead><tr style="background:#f5f5f5">
            <th style="border:1px solid #ddd;padding:8px;width:40px">No</th>
            <th style="border:1px solid #ddd;padding:8px">Deskripsi</th>
            <th style="border:1px solid #ddd;padding:8px;width:80px">Qty</th>
            <th style="border:1px solid #ddd;padding:8px;width:80px">Satuan</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:60px">
          <div style="text-align:center;width:200px">
            <p style="margin:0;border-top:1px solid #333;padding-top:10px">Pengirim</p>
          </div>
          <div style="text-align:center;width:200px">
            <p style="margin:0;border-top:1px solid #333;padding-top:10px">Penerima</p>
          </div>
        </div>
      </div>
    `;

    return this.generatePdf(html);
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
