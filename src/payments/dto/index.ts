import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(1)
  amount!: number; // Minor units

  @IsEnum(['cash', 'transfer', 'ewallet', 'qris', 'other'])
  method!: 'cash' | 'transfer' | 'ewallet' | 'qris' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
