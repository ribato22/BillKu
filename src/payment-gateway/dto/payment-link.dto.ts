import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { PaymentGatewayProvider } from '@prisma/client';

export class CreatePaymentLinkDto {
  @IsOptional()
  @IsEnum(PaymentGatewayProvider)
  provider?: PaymentGatewayProvider;

  @IsOptional()
  @IsNumber()
  expiryMinutes?: number;

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}
