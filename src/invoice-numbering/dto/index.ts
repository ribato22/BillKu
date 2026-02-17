import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ResetPeriod } from '@prisma/client';

export class UpdateInvoiceNumberingDto {
  @IsString()
  pattern!: string;

  @IsEnum(['yearly', 'monthly', 'none'])
  resetPeriod!: ResetPeriod;
}

export class PreviewInvoiceNumberDto {
  @IsOptional()
  @IsString()
  issueDate?: string;
}
