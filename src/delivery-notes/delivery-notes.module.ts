import { Module } from '@nestjs/common';
import { DeliveryNotesService } from './delivery-notes.service';
import { DeliveryNotesController } from './delivery-notes.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [DeliveryNotesService],
  controllers: [DeliveryNotesController],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
