import { Injectable, Logger } from '@nestjs/common';
import { PaymentGatewayProvider } from '@prisma/client';
import * as crypto from 'crypto';
import {
  PaymentAdapter,
  CreatePaymentParams,
  PaymentLinkResult,
  PaymentStatus,
  WebhookResult,
} from './payment-adapter.interface';

interface MidtransCredentials {
  serverKey: string;
  clientKey?: string;
  merchantId?: string;
  isSandbox: boolean;
}

interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}

interface MidtransNotification {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status?: string;
  currency: string;
}

@Injectable()
export class MidtransAdapter implements PaymentAdapter {
  private readonly logger = new Logger(MidtransAdapter.name);
  
  readonly provider = PaymentGatewayProvider.MIDTRANS;

  private getBaseUrl(isSandbox: boolean): string {
    return isSandbox
      ? 'https://app.sandbox.midtrans.com'
      : 'https://app.midtrans.com';
  }

  private getApiUrl(isSandbox: boolean): string {
    return isSandbox
      ? 'https://api.sandbox.midtrans.com'
      : 'https://api.midtrans.com';
  }

  async createPaymentLink(
    params: CreatePaymentParams,
    credentials: MidtransCredentials,
  ): Promise<PaymentLinkResult> {
    const { serverKey, isSandbox } = credentials;
    const baseUrl = this.getBaseUrl(isSandbox);
    
    // Calculate expiry time
    const expiryMinutes = params.expiryDuration || 1440; // Default 24 hours
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const payload = {
      transaction_details: {
        order_id: params.externalId,
        gross_amount: params.amount,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail || undefined,
        phone: params.customerPhone || undefined,
      },
      item_details: [
        {
          id: params.invoiceId,
          price: params.amount,
          quantity: 1,
          name: params.description.substring(0, 50), // Max 50 chars
        },
      ],
      expiry: {
        unit: 'minutes',
        duration: expiryMinutes,
      },
      callbacks: {
        finish: params.redirectUrl,
      },
    };

    try {
      const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Midtrans API error: ${response.status} - ${errorText}`);
        throw new Error(`Midtrans API error: ${response.status}`);
      }

      const data = (await response.json()) as MidtransSnapResponse;

      return {
        success: true,
        externalId: params.externalId,
        paymentUrl: data.redirect_url,
        expiresAt,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Failed to create Midtrans payment link', error);
      throw error;
    }
  }

  async getPaymentStatus(
    externalId: string,
    credentials: { serverKey: string; isSandbox: boolean },
  ): Promise<PaymentStatus> {
    const { serverKey, isSandbox } = credentials;
    const apiUrl = this.getApiUrl(isSandbox);

    try {
      const response = await fetch(`${apiUrl}/v2/${externalId}/status`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Midtrans status API error: ${response.status}`);
      }

      const data = (await response.json()) as MidtransNotification;

      return {
        externalId: data.order_id,
        status: this.mapTransactionStatus(data.transaction_status),
        paidAt: data.transaction_status === 'settlement' || data.transaction_status === 'capture'
          ? new Date(data.transaction_time)
          : undefined,
        paidAmount: parseInt(data.gross_amount, 10),
        paymentMethod: data.payment_type,
      };
    } catch (error) {
      this.logger.error('Failed to get Midtrans payment status', error);
      throw error;
    }
  }

  validateWebhook(
    payload: unknown,
    _signature: string,
    credentials: { serverKey: string },
  ): boolean {
    const notification = payload as MidtransNotification;
    
    // Midtrans uses signature_key in payload, not separate header
    const { order_id, status_code, gross_amount, signature_key } = notification;
    
    // Generate expected signature
    const signatureString = order_id + status_code + gross_amount + credentials.serverKey;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(signatureString)
      .digest('hex');

    return expectedSignature === signature_key;
  }

  parseWebhookPayload(payload: unknown): WebhookResult {
    const notification = payload as MidtransNotification;

    return {
      isValid: true,
      externalId: notification.order_id,
      status: this.mapTransactionStatus(notification.transaction_status),
      paidAt: notification.transaction_status === 'settlement' || notification.transaction_status === 'capture'
        ? new Date(notification.transaction_time)
        : undefined,
      paidAmount: parseInt(notification.gross_amount, 10),
      paymentMethod: notification.payment_type,
      rawData: notification,
    };
  }

  private mapTransactionStatus(
    status: string,
  ): 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed' {
    switch (status) {
      case 'capture':
      case 'settlement':
        return 'paid';
      case 'expire':
        return 'expired';
      case 'cancel':
        return 'cancelled';
      case 'deny':
      case 'failure':
        return 'failed';
      case 'pending':
      default:
        return 'pending';
    }
  }
}
