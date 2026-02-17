import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { WAProvider } from '@prisma/client';

export class ConnectWhatsAppDto {
  @IsEnum(WAProvider)
  @IsOptional()
  provider?: WAProvider = WAProvider.BAILEYS;
}

export class SendMessageDto {
  @IsString()
  phoneNumber: string;

  @IsString()
  message: string;
}

export class CreateReminderScheduleDto {
  @IsNumber()
  triggerDays: number; // -3, -1, 0, 1, 7 etc.

  @IsString()
  template: string;
}

export class UpdateReminderScheduleDto {
  @IsString()
  @IsOptional()
  template?: string;

  @IsOptional()
  isActive?: boolean;
}
