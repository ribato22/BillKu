import { db, type Invoice } from "./index";
import { customerService } from "./customers";
import { paymentService } from "./payments";

export interface ReminderTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "email" | "sms";
  subject?: string; // For email
  body: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

// Available template variables
export const REMINDER_VARIABLES: ReminderVariable[] = [
  { key: "{{customer_name}}", label: "Nama Pelanggan", description: "Nama lengkap pelanggan", example: "CV Maju Bersama" },
  { key: "{{invoice_number}}", label: "Nomor Invoice", description: "Nomor invoice", example: "INV-202602-0001" },
  { key: "{{invoice_amount}}", label: "Total Invoice", description: "Total tagihan invoice", example: "Rp 15.000.000" },
  { key: "{{remaining_amount}}", label: "Sisa Tagihan", description: "Sisa yang belum dibayar", example: "Rp 10.000.000" },
  { key: "{{due_date}}", label: "Tanggal Jatuh Tempo", description: "Tanggal jatuh tempo", example: "15 Februari 2026" },
  { key: "{{days_overdue}}", label: "Hari Terlambat", description: "Jumlah hari keterlambatan", example: "7" },
  { key: "{{company_name}}", label: "Nama Usaha", description: "Nama usaha Anda", example: "Toko Maju Jaya" },
  { key: "{{bank_account}}", label: "Rekening Bank", description: "Info rekening bank", example: "BCA 1234567890" },
];

// Default templates
export const DEFAULT_TEMPLATES: Omit<ReminderTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Pengingat Jatuh Tempo",
    type: "whatsapp",
    body: `Yth. {{customer_name}},

Kami ingin mengingatkan bahwa invoice *{{invoice_number}}* dengan total *{{invoice_amount}}* akan jatuh tempo pada *{{due_date}}*.

Mohon untuk segera melakukan pembayaran ke:
{{bank_account}}

Terima kasih atas kerjasamanya.

Salam,
{{company_name}}`,
    isDefault: true,
  },
  {
    name: "Pengingat Terlambat",
    type: "whatsapp",
    body: `Yth. {{customer_name}},

Invoice *{{invoice_number}}* dengan sisa tagihan *{{remaining_amount}}* telah melewati tanggal jatuh tempo selama *{{days_overdue}} hari*.

Mohon segera lakukan pembayaran ke:
{{bank_account}}

Jika sudah melakukan pembayaran, mohon abaikan pesan ini.

Terima kasih,
{{company_name}}`,
    isDefault: true,
  },
  {
    name: "Konfirmasi Pembayaran",
    type: "whatsapp",
    body: `Yth. {{customer_name}},

Terima kasih atas pembayaran untuk invoice *{{invoice_number}}*.

Sisa tagihan Anda saat ini: *{{remaining_amount}}*

Kami sangat menghargai kerjasama Anda.

Salam hangat,
{{company_name}}`,
    isDefault: true,
  },
];

// Business settings (stored in localStorage for now)
interface BusinessSettings {
  companyName: string;
  bankAccount: string;
  whatsappNumber?: string;
}

export const reminderService = {
  // Get business settings
  getBusinessSettings(): BusinessSettings {
    if (typeof window === "undefined") {
      return { companyName: "", bankAccount: "" };
    }
    const stored = localStorage.getItem("billku-business-settings");
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      companyName: "Toko Maju Jaya",
      bankAccount: "BCA 1234567890 a.n. Toko Maju Jaya",
    };
  },

  // Save business settings
  saveBusinessSettings(settings: BusinessSettings): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("billku-business-settings", JSON.stringify(settings));
  },

  // Get all templates
  getTemplates(): ReminderTemplate[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("billku-reminder-templates");
    if (stored) {
      return JSON.parse(stored);
    }
    // Return default templates
    return DEFAULT_TEMPLATES.map((t, index) => ({
      ...t,
      id: `default-${index}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  },

  // Save templates
  saveTemplates(templates: ReminderTemplate[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("billku-reminder-templates", JSON.stringify(templates));
  },

  // Get template by ID
  getTemplateById(id: string): ReminderTemplate | undefined {
    const templates = this.getTemplates();
    return templates.find((t) => t.id === id);
  },

  // Fill template variables with actual data
  async fillTemplate(
    template: ReminderTemplate,
    invoiceId: string
  ): Promise<string> {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const customer = await customerService.getById(invoice.customerId);
    const remaining = await paymentService.getRemainingBalance(invoiceId);
    const settings = this.getBusinessSettings();

    // Calculate days overdue
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.max(
      0,
      Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Format date
    const formatDate = (date: Date) => {
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount);
    };

    let text = template.body;

    // Replace variables
    text = text.replace(/{{customer_name}}/g, customer?.name || "Pelanggan");
    text = text.replace(/{{invoice_number}}/g, invoice.invoiceNumber);
    text = text.replace(/{{invoice_amount}}/g, formatCurrency(invoice.total));
    text = text.replace(/{{remaining_amount}}/g, formatCurrency(remaining));
    text = text.replace(/{{due_date}}/g, formatDate(dueDate));
    text = text.replace(/{{days_overdue}}/g, daysOverdue.toString());
    text = text.replace(/{{company_name}}/g, settings.companyName);
    text = text.replace(/{{bank_account}}/g, settings.bankAccount);

    return text;
  },

  // Generate WhatsApp deep link
  async generateWhatsAppLink(
    templateId: string,
    invoiceId: string
  ): Promise<string> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error("Template not found");

    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const customer = await customerService.getById(invoice.customerId);
    if (!customer?.phone) throw new Error("Customer phone not found");

    const message = await this.fillTemplate(template, invoiceId);

    // Format phone number (remove non-digits, add country code if needed)
    let phone = customer.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) {
      phone = "62" + phone.substring(1);
    }

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    return `https://wa.me/${phone}?text=${encodedMessage}`;
  },

  // Get invoices that need reminders
  async getInvoicesNeedingReminders(): Promise<
    Array<{
      invoice: Invoice;
      customerName: string;
      remaining: number;
      daysOverdue: number;
    }>
  > {
    const invoices = await db.invoices
      .where("status")
      .anyOf(["draft", "sent"])
      .toArray();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];

    for (const invoice of invoices) {
      const remaining = await paymentService.getRemainingBalance(invoice.id!);
      if (remaining <= 0) continue;

      const customer = await customerService.getById(invoice.customerId);
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const daysOverdue = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      results.push({
        invoice,
        customerName: customer?.name || "Unknown",
        remaining,
        daysOverdue,
      });
    }

    // Sort by days overdue (most overdue first)
    return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
  },
};
