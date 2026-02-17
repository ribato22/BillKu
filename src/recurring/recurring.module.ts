import { Module } from '@nestjs/common';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringCron } from './recurring.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, InvoicesModule, AuditModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringCron],
  exports: [RecurringService],
})
export class RecurringModule {}
