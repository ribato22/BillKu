import { Module } from '@nestjs/common';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { InvoiceNumberingController } from './invoice-numbering.controller';

@Module({
  providers: [InvoiceNumberingService],
  controllers: [InvoiceNumberingController],
  exports: [InvoiceNumberingService],
})
export class InvoiceNumberingModule {}
