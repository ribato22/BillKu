import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceNumberingModule } from '../invoice-numbering/invoice-numbering.module';
import { InvoiceTemplateService } from './invoice-template.service';
import { InvoiceTemplatesModule } from '../invoice-templates/invoice-templates.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [InvoiceNumberingModule, InvoiceTemplatesModule, AuditModule],
  providers: [InvoicesService, InvoiceTemplateService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}


