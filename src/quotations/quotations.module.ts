import { Module } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { QuotationsController } from './quotations.controller';
import { PdfModule } from '../pdf/pdf.module';
import { EmailModule } from '../email/email.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AuditModule } from '../audit/audit.module';
import { InvoiceTemplatesModule } from '../invoice-templates/invoice-templates.module';

@Module({
  imports: [PdfModule, EmailModule, WhatsAppModule, AuditModule, InvoiceTemplatesModule],
  providers: [QuotationsService],
  controllers: [QuotationsController],
  exports: [QuotationsService],
})
export class QuotationsModule {}

