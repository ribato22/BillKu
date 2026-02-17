import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGatewayProvider, PaymentLinkStatus, InvoiceStatus } from '@prisma/client';
import { PaymentAdapterFactory } from './adapters';
import { CreateGatewayConfigDto, UpdateGatewayConfigDto, CreatePaymentLinkDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterFactory: PaymentAdapterFactory,
  ) {}

  // ============== Gateway Config Management ==============

  async getConfigs(businessId: string) {
    return this.prisma.paymentGatewayConfig.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConfig(businessId: string, dto: CreateGatewayConfigDto) {
    // Check if adapter exists for this provider
    if (!this.adapterFactory.hasAdapter(dto.provider)) {
      throw new BadRequestException(`Provider ${dto.provider} is not yet supported`);
    }

    return this.prisma.paymentGatewayConfig.create({
      data: {
        businessId,
        provider: dto.provider,
        serverKey: dto.serverKey,
        clientKey: dto.clientKey,
        merchantId: dto.merchantId,
        isActive: dto.isActive ?? true,
        isSandbox: dto.isSandbox ?? true,
      },
    });
  }

  async updateConfig(businessId: string, configId: string, dto: UpdateGatewayConfigDto) {
    const config = await this.prisma.paymentGatewayConfig.findFirst({
      where: { id: configId, businessId },
    });

    if (!config) {
      throw new NotFoundException('Payment gateway config not found');
    }

    return this.prisma.paymentGatewayConfig.update({
      where: { id: configId },
      data: dto,
    });
  }

  async deleteConfig(businessId: string, configId: string) {
    const config = await this.prisma.paymentGatewayConfig.findFirst({
      where: { id: configId, businessId },
    });

    if (!config) {
      throw new NotFoundException('Payment gateway config not found');
    }

    return this.prisma.paymentGatewayConfig.delete({
      where: { id: configId },
    });
  }

  // ============== Payment Link Management ==============

  async createPaymentLink(
    businessId: string,
    invoiceId: string,
    dto: CreatePaymentLinkDto,
  ) {
    // Get invoice with customer details
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.paid) {
      throw new BadRequestException('Invoice is already paid');
    }

    // Get active gateway config
    const config = await this.getActiveConfig(businessId, dto.provider);

    // Check for existing active payment link
    const existingLink = await this.prisma.paymentLink.findFirst({
      where: {
        invoiceId,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingLink) {
      return existingLink;
    }

    // Generate unique external ID
    const externalId = `INV-${invoice.invoiceNumber}-${uuidv4().substring(0, 8)}`;

    // Get adapter and create payment link
    const adapter = this.adapterFactory.getAdapter(config.provider);
    
    const result = await adapter.createPaymentLink(
      {
        invoiceId: invoice.id,
        externalId,
        amount: Number(invoice.total),
        customerName: invoice.customer.name,
        customerEmail: invoice.customer.email || undefined,
        customerPhone: invoice.customer.phone || undefined,
        description: `Pembayaran ${invoice.invoiceNumber}`,
        expiryDuration: dto.expiryMinutes || 1440,
        redirectUrl: dto.redirectUrl,
      },
      {
        serverKey: config.serverKey,
        clientKey: config.clientKey || undefined,
        merchantId: config.merchantId || undefined,
        isSandbox: config.isSandbox,
      },
    );

    // Save payment link to database
    const paymentLink = await this.prisma.paymentLink.create({
      data: {
        invoiceId: invoice.id,
        configId: config.id,
        externalId: result.externalId,
        paymentUrl: result.paymentUrl,
        amount: BigInt(invoice.total),
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: result.expiresAt,
        webhookData: JSON.stringify(result.rawResponse),
      },
    });

    return paymentLink;
  }

  async getPaymentLink(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.paymentLink.findFirst({
      where: {
        invoiceId,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { config: true },
    });
  }

  // Public method for customer payment page
  async getPaymentLinkById(linkId: string) {
    const link = await this.prisma.paymentLink.findFirst({
      where: { id: linkId },
      include: {
        invoice: {
          include: {
            customer: true,
            business: true,
            items: true,
          },
        },
        config: {
          select: {
            provider: true,
            isSandbox: true,
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Payment link not found');
    }

    // Return sanitized data (no sensitive info)
    return {
      id: link.id,
      paymentUrl: link.paymentUrl,
      amount: link.amount.toString(),
      status: link.status,
      expiresAt: link.expiresAt,
      paidAt: link.paidAt,
      provider: link.config.provider,
      isSandbox: link.config.isSandbox,
      invoice: {
        invoiceNumber: link.invoice.invoiceNumber,
        issueDate: link.invoice.issueDate,
        dueDate: link.invoice.dueDate,
        subtotal: link.invoice.subtotal.toString(),
        total: link.invoice.total.toString(),
        currencyCode: link.invoice.currencyCode,
        items: link.invoice.items.map((item) => ({
          description: item.description,
          qty: item.qty.toString(),
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
        })),
      },
      customer: {
        name: link.invoice.customer.name,
      },
      business: {
        name: link.invoice.business.name,
        address: link.invoice.business.address,
      },
    };
  }

  async cancelPaymentLink(businessId: string, linkId: string) {
    const link = await this.prisma.paymentLink.findFirst({
      where: { id: linkId },
      include: { invoice: true },
    });

    if (!link || link.invoice.businessId !== businessId) {
      throw new NotFoundException('Payment link not found');
    }

    return this.prisma.paymentLink.update({
      where: { id: linkId },
      data: { status: PaymentLinkStatus.CANCELLED },
    });
  }

  // ============== Webhook Processing ==============

  async processWebhook(provider: PaymentGatewayProvider, payload: unknown, signature?: string) {
    const adapter = this.adapterFactory.getAdapter(provider);

    // Find config by external ID to get credentials
    const parsed = adapter.parseWebhookPayload(payload);
    if (!parsed.externalId) {
      this.logger.warn('Webhook missing external ID');
      return { success: false, message: 'Missing external ID' };
    }

    const paymentLink = await this.prisma.paymentLink.findFirst({
      where: { externalId: parsed.externalId },
      include: { config: true, invoice: true },
    });

    if (!paymentLink) {
      this.logger.warn(`Payment link not found for external ID: ${parsed.externalId}`);
      return { success: false, message: 'Payment link not found' };
    }

    // Validate signature
    if (signature && !adapter.validateWebhook(payload, signature, { serverKey: paymentLink.config.serverKey })) {
      this.logger.warn('Invalid webhook signature');
      return { success: false, message: 'Invalid signature' };
    }

    // Update payment link status
    const newStatus = this.mapWebhookStatus(parsed.status);
    
    await this.prisma.$transaction(async (tx) => {
      // Update payment link
      await tx.paymentLink.update({
        where: { id: paymentLink.id },
        data: {
          status: newStatus,
          paidAt: parsed.paidAt,
          webhookData: JSON.stringify(parsed.rawData),
        },
      });

      // If paid, record payment and update invoice
      if (parsed.status === 'paid' && parsed.paidAmount) {
        await tx.payment.create({
          data: {
            invoiceId: paymentLink.invoiceId,
            amount: BigInt(parsed.paidAmount),
            currencyCode: paymentLink.invoice.currencyCode,
            date: parsed.paidAt || new Date(),
            method: 'ewallet',
            note: `Paid via ${provider} - ${parsed.paymentMethod || 'unknown'}`,
          },
        });

        // Update invoice status
        const totalPaid = await tx.payment.aggregate({
          where: { invoiceId: paymentLink.invoiceId },
          _sum: { amount: true },
        });

        const paidAmount = totalPaid._sum.amount || BigInt(0);
        const invoiceStatus = paidAmount >= paymentLink.invoice.total
          ? InvoiceStatus.paid
          : InvoiceStatus.partial;

        await tx.invoice.update({
          where: { id: paymentLink.invoiceId },
          data: { status: invoiceStatus },
        });
      }
    });

    return { success: true, status: newStatus };
  }

  // ============== Helper Methods ==============

  private async getActiveConfig(businessId: string, provider?: PaymentGatewayProvider) {
    const where: Record<string, unknown> = { businessId, isActive: true };
    if (provider) {
      where.provider = provider;
    }

    const config = await this.prisma.paymentGatewayConfig.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new BadRequestException('No active payment gateway configured. Please configure a payment gateway first.');
    }

    return config;
  }

  private mapWebhookStatus(status?: string): PaymentLinkStatus {
    switch (status) {
      case 'paid':
        return PaymentLinkStatus.PAID;
      case 'expired':
        return PaymentLinkStatus.EXPIRED;
      case 'cancelled':
        return PaymentLinkStatus.CANCELLED;
      default:
        return PaymentLinkStatus.ACTIVE;
    }
  }

  getSupportedProviders() {
    return this.adapterFactory.getSupportedProviders();
  }
}
