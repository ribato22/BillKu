import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentGatewayController, WebhookController, PublicPaymentController } from './payment-gateway.controller';
import { MidtransAdapter, PaymentAdapterFactory } from './adapters';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentGatewayController, WebhookController, PublicPaymentController],
  providers: [
    PaymentGatewayService,
    MidtransAdapter,
    PaymentAdapterFactory,
  ],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
