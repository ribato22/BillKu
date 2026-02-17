import { IsString, IsOptional, IsDateString, IsNumber, IsEnum } from 'class-validator';

enum ExpenseCategory {
  operational = 'operational',
  material = 'material',
  salary = 'salary',
  utilities = 'utilities',
  marketing = 'marketing',
  other = 'other',
}

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  categoryType!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  categoryType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
