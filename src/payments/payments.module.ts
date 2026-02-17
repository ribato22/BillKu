import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController, PaymentsListController } from './payments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsListController],
  exports: [PaymentsService],
})
export class PaymentsModule {}

