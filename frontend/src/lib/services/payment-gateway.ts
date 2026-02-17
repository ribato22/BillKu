// Payment Gateway service for frontend
// Uses authService.fetchWithAuth for authenticated API calls

import { authService } from "@/lib/auth";

interface PaymentGatewayConfig {
  id: string;
  businessId: string;
  provider: 'MIDTRANS' | 'XENDIT' | 'DOKU' | 'IPAYMU' | 'TRIPAY';
  serverKey: string;
  clientKey?: string;
  merchantId?: string;
  isActive: boolean;
  isSandbox: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentLink {
  id: string;
  invoiceId: string;
  externalId: string;
  paymentUrl: string;
  amount: string;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  paidAt?: string;
  createdAt: string;
}

interface CreateConfigDto {
  provider: PaymentGatewayConfig['provider'];
  serverKey: string;
  clientKey?: string;
  merchantId?: string;
  isActive?: boolean;
  isSandbox?: boolean;
}

interface CreatePaymentLinkDto {
  provider?: PaymentGatewayConfig['provider'];
  expiryMinutes?: number;
  redirectUrl?: string;
}

class PaymentGatewayService {
  // ============== Gateway Config ==============

  async getConfigs(): Promise<PaymentGatewayConfig[]> {
    const response = await authService.fetchWithAuth('/payment-gateway/config');
    if (!response.ok) throw new Error('Failed to fetch configs');
    return response.json();
  }

  async getSupportedProviders(): Promise<{ supported: string[]; all: string[] }> {
    const response = await authService.fetchWithAuth('/payment-gateway/providers');
    if (!response.ok) throw new Error('Failed to fetch providers');
    return response.json();
  }

  async createConfig(dto: CreateConfigDto): Promise<PaymentGatewayConfig> {
    const response = await authService.fetchWithAuth('/payment-gateway/config', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create config');
    }
    return response.json();
  }

  async updateConfig(
    id: string,
    dto: Partial<CreateConfigDto>,
  ): Promise<PaymentGatewayConfig> {
    const response = await authService.fetchWithAuth(`/payment-gateway/config/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw new Error('Failed to update config');
    return response.json();
  }

  async deleteConfig(id: string): Promise<void> {
    const response = await authService.fetchWithAuth(`/payment-gateway/config/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete config');
  }

  // ============== Payment Links ==============

  async createPaymentLink(
    invoiceId: string,
    dto?: CreatePaymentLinkDto,
  ): Promise<PaymentLink> {
    const response = await authService.fetchWithAuth(
      `/invoices/${invoiceId}/payment-link`,
      {
        method: 'POST',
        body: JSON.stringify(dto || {}),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create payment link');
    }
    return response.json();
  }

  async getPaymentLink(invoiceId: string): Promise<PaymentLink | null> {
    const response = await authService.fetchWithAuth(
      `/invoices/${invoiceId}/payment-link`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async cancelPaymentLink(linkId: string): Promise<void> {
    const response = await authService.fetchWithAuth(`/payment-links/${linkId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to cancel payment link');
  }
}

export const paymentGatewayService = new PaymentGatewayService();
export type { PaymentGatewayConfig, PaymentLink, CreateConfigDto, CreatePaymentLinkDto };
