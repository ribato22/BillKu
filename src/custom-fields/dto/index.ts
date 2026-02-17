import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateCustomFieldDto {
  @IsString()
  entity: string; // "invoice", "customer", "product"

  @IsString()
  fieldName: string;

  @IsString()
  fieldType: string; // "text", "number", "date", "select"

  @IsOptional()
  @IsString()
  options?: string; // JSON array for select type

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  position?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  fieldName?: string;

  @IsOptional()
  @IsString()
  fieldType?: string;

  @IsOptional()
  @IsString()
  options?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  position?: number;
}

export class SetCustomFieldValueDto {
  @IsString()
  customFieldId: string;

  @IsString()
  entityId: string;

  @IsString()
  value: string;
}
