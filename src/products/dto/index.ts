import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(0)
  price!: number; // Price in minor units (cents/sen)

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string; // e.g., "pcs", "kg", "hour"

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockAlert?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockAlert?: number;
}

export class AdjustStockDto {
  @IsInt()
  adjustment!: number; // positive to add, negative to deduct

  @IsOptional()
  @IsString()
  reason?: string;
}
