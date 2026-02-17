import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0.01)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number; // Minor units
}

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRateBps?: number; // e.g. 1100 = 11%

  @IsOptional()
  @IsEnum(['percent', 'amount'])
  discountType?: 'percent' | 'amount';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRateBps?: number;

  @IsOptional()
  @IsEnum(['percent', 'amount'])
  discountType?: 'percent' | 'amount';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(['draft', 'sent', 'paid', 'overdue', 'canceled'])
  status!: string;
}
