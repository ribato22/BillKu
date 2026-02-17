import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateInvoiceTemplateDto {
  @IsString()
  name: string;

  @IsString()
  htmlBody: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInvoiceTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
