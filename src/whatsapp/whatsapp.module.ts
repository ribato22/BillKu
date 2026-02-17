import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppGateway } from './whatsapp.gateway';
import { BaileysAdapter } from './adapters/baileys.adapter';
import { ReminderSchedulerService } from './reminder.scheduler';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppGateway, BaileysAdapter, ReminderSchedulerService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}

