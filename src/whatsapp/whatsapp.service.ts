import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaileysAdapter } from './adapters/baileys.adapter';
import { WAProvider, ReminderLogStatus } from '@prisma/client';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly baileysAdapter: BaileysAdapter,
  ) {
    // Listen for connection events
    this.baileysAdapter.on('connected', async ({ businessId, phoneNumber }) => {
      await this.updateConnectionStatus(businessId, true, phoneNumber);
    });
  }

  /**
   * Start WhatsApp connection for a business
   */
  async connect(businessId: string): Promise<{ qr?: string; connected: boolean }> {
    try {
      // Ensure config exists
      await this.prisma.whatsAppConfig.upsert({
        where: { businessId },
        create: { businessId, provider: WAProvider.BAILEYS },
        update: {},
      });

      return await this.baileysAdapter.connect(businessId);
    } catch (error) {
      this.logger.error(`Failed to connect WhatsApp for business ${businessId}: ${error.message}`);
      throw new Error(`Gagal menghubungkan WhatsApp: ${error.message}`);
    }
  }

  /**
   * Get current QR code
   */
  getQRCode(businessId: string): string | null {
    return this.baileysAdapter.getQRCode(businessId);
  }

  /**
   * Get connection status
   */
  async getStatus(businessId: string): Promise<{
    isConnected: boolean;
    phoneNumber: string | null;
    provider: WAProvider;
  }> {
    const config = await this.prisma.whatsAppConfig.findUnique({
      where: { businessId },
    });

    return {
      isConnected: this.baileysAdapter.isConnected(businessId) || (config?.isConnected ?? false),
      phoneNumber: this.baileysAdapter.getPhoneNumber(businessId) || config?.phoneNumber || null,
      provider: config?.provider ?? WAProvider.BAILEYS,
    };
  }

  /**
   * Disconnect WhatsApp
   */
  async disconnect(businessId: string): Promise<void> {
    await this.baileysAdapter.disconnect(businessId, true);
    await this.updateConnectionStatus(businessId, false);
  }

  /**
   * Send message and log it
   */
  async sendMessage(
    businessId: string,
    phoneNumber: string,
    message: string,
    invoiceId?: string,
    scheduleId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.baileysAdapter.sendMessage(
      businessId,
      phoneNumber,
      message,
    );

    // Log the message if invoice context provided
    if (invoiceId) {
      await this.prisma.reminderLog.create({
        data: {
          invoiceId,
          scheduleId,
          phoneNumber,
          message,
          status: result.success ? ReminderLogStatus.SENT : ReminderLogStatus.FAILED,
          sentAt: result.success ? new Date() : null,
          error: result.error,
        },
      });
    }

    return result;
  }

  /**
   * Send document (e.g., PDF) via WhatsApp
   */
  async sendDocument(
    businessId: string,
    phoneNumber: string,
    document: Buffer,
    filename: string,
    caption?: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.baileysAdapter.sendDocument(
      businessId,
      phoneNumber,
      document,
      filename,
      caption,
    );
  }

  /**
   * Send invoice reminder
   */
  async sendInvoiceReminder(
    businessId: string,
    invoiceId: string,
    template?: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Get invoice with customer
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { customer: true, business: true },
    });

    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (!invoice.customer.phone) {
      return { success: false, error: 'Customer has no phone number' };
    }

    // Use template or default
    const messageTemplate = template || 
      `Halo {customer_name},\n\nIni adalah pengingat untuk Invoice #{invoice_number} sebesar Rp {amount}.\nJatuh tempo: {due_date}\n\nMohon segera lakukan pembayaran. Terima kasih.`;

    // Replace variables
    const message = this.replaceTemplateVariables(messageTemplate, {
      customer_name: invoice.customer.name,
      invoice_number: invoice.invoiceNumber,
      amount: this.formatCurrency(invoice.total),
      due_date: invoice.dueDate.toLocaleDateString('id-ID'),
      business_name: invoice.business.name,
    });

    return this.sendMessage(
      businessId,
      invoice.customer.phone,
      message,
      invoiceId,
    );
  }

  /**
   * Update connection status in database
   */
  private async updateConnectionStatus(
    businessId: string,
    isConnected: boolean,
    phoneNumber?: string | null,
  ): Promise<void> {
    await this.prisma.whatsAppConfig.update({
      where: { businessId },
      data: {
        isConnected,
        phoneNumber: phoneNumber ?? undefined,
        lastSeen: isConnected ? new Date() : undefined,
      },
    });
  }

  /**
   * Replace template variables
   */
  private replaceTemplateVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Format currency to Indonesian format
   */
  private formatCurrency(amount: bigint | number): string {
    const num = typeof amount === 'bigint' ? Number(amount) : amount;
    return new Intl.NumberFormat('id-ID').format(num);
  }

  // ===== Reminder Schedule Management =====

  async createReminderSchedule(
    businessId: string,
    triggerDays: number,
    template: string,
  ) {
    return this.prisma.reminderSchedule.upsert({
      where: { businessId_triggerDays: { businessId, triggerDays } },
      create: { businessId, triggerDays, template },
      update: { template },
    });
  }

  async listReminderSchedules(businessId: string) {
    return this.prisma.reminderSchedule.findMany({
      where: { businessId },
      orderBy: { triggerDays: 'asc' },
    });
  }

  async updateReminderSchedule(
    id: string,
    businessId: string,
    data: { template?: string; isActive?: boolean },
  ) {
    return this.prisma.reminderSchedule.update({
      where: { id, businessId },
      data,
    });
  }

  async deleteReminderSchedule(id: string, businessId: string) {
    return this.prisma.reminderSchedule.delete({
      where: { id, businessId },
    });
  }

  async getReminderLogs(invoiceId: string, businessId: string) {
    return this.prisma.reminderLog.findMany({
      where: { 
        invoiceId,
        invoice: { businessId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
