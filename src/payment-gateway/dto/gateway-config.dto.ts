import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { PaymentGatewayProvider } from '@prisma/client';

export class CreateGatewayConfigDto {
  @IsEnum(PaymentGatewayProvider)
  provider: PaymentGatewayProvider;

  @IsString()
  serverKey: string;

  @IsOptional()
  @IsString()
  clientKey?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;
}

export class UpdateGatewayConfigDto {
  @IsOptional()
  @IsString()
  serverKey?: string;

  @IsOptional()
  @IsString()
  clientKey?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;
}
