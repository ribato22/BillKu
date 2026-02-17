import { PaymentGatewayProvider } from '@prisma/client';

export interface CreatePaymentParams {
  invoiceId: string;
  externalId: string;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  expiryDuration?: number; // in minutes
  callbackUrl?: string;
  redirectUrl?: string;
}

export interface PaymentLinkResult {
  success: boolean;
  externalId: string;
  paymentUrl: string;
  expiresAt: Date;
  rawResponse?: unknown;
}

export interface PaymentStatus {
  externalId: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed';
  paidAt?: Date;
  paidAmount?: number;
  paymentMethod?: string;
}

export interface WebhookResult {
  isValid: boolean;
  externalId?: string;
  status?: 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed';
  paidAt?: Date;
  paidAmount?: number;
  paymentMethod?: string;
  rawData?: unknown;
}

export interface PaymentAdapter {
  /**
   * The provider this adapter handles
   */
  readonly provider: PaymentGatewayProvider;

  /**
   * Create a payment link for an invoice
   */
  createPaymentLink(
    params: CreatePaymentParams,
    credentials: { serverKey: string; clientKey?: string; merchantId?: string; isSandbox: boolean },
  ): Promise<PaymentLinkResult>;

  /**
   * Get the current status of a payment
   */
  getPaymentStatus(
    externalId: string,
    credentials: { serverKey: string; isSandbox: boolean },
  ): Promise<PaymentStatus>;

  /**
   * Validate webhook signature
   */
  validateWebhook(
    payload: unknown,
    signature: string,
    credentials: { serverKey: string },
  ): boolean;

  /**
   * Parse webhook payload into standardized format
   */
  parseWebhookPayload(payload: unknown): WebhookResult;
}
