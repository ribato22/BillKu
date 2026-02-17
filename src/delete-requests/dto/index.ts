import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ResourceType, DeleteRequestStatus } from '@prisma/client';

export class CreateDeleteRequestDto {
  @IsEnum(['customer', 'invoice', 'payment', 'business'])
  resourceType!: ResourceType;

  @IsString()
  resourceId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateDeleteRequestDto {
  @IsEnum(['approved', 'rejected', 'canceled'])
  status!: DeleteRequestStatus;
}
