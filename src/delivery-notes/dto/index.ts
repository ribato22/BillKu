import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryNoteItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateDeliveryNoteDto {
  @IsString()
  invoiceId!: string;

  @IsDateString()
  deliveryDate!: string;

  @IsString()
  recipient!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryNoteItemDto)
  items!: DeliveryNoteItemDto[];
}
