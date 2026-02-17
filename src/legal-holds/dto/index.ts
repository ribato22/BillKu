import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateLegalHoldDto {
  @IsEnum(['customer', 'invoice', 'payment', 'business'])
  resourceType!: ResourceType;

  @IsString()
  resourceId!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class ReleaseLegalHoldDto {
  @IsOptional()
  @IsString()
  releaseReason?: string;
}
