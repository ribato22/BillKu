import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentGatewayProvider } from '@prisma/client';
import { PaymentAdapter } from './payment-adapter.interface';
import { MidtransAdapter } from './midtrans.adapter';

@Injectable()
export class PaymentAdapterFactory {
  private adapters: Map<PaymentGatewayProvider, PaymentAdapter> = new Map();

  constructor(
    private readonly midtransAdapter: MidtransAdapter,
    // Add more adapters as needed
    // private readonly xenditAdapter: XenditAdapter,
    // private readonly dokuAdapter: DokuAdapter,
  ) {
    this.registerAdapter(midtransAdapter);
  }

  private registerAdapter(adapter: PaymentAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  getAdapter(provider: PaymentGatewayProvider): PaymentAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(
        `Payment provider "${provider}" is not configured. Supported providers: ${this.getSupportedProviders().join(', ')}`,
      );
    }
    return adapter;
  }

  getSupportedProviders(): PaymentGatewayProvider[] {
    return Array.from(this.adapters.keys());
  }

  hasAdapter(provider: PaymentGatewayProvider): boolean {
    return this.adapters.has(provider);
  }
}
