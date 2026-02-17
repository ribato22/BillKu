import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { InvoiceNumberingModule } from './invoice-numbering/invoice-numbering.module';
import { DeleteRequestsModule } from './delete-requests/delete-requests.module';
import { LegalHoldsModule } from './legal-holds/legal-holds.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { RemindersModule } from './reminders/reminders.module';
import { PdfModule } from './pdf/pdf.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { RolesModule } from './roles/roles.module';
import { RecurringModule } from './recurring/recurring.module';
import { AuditModule } from './audit/audit.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DeliveryNotesModule } from './delivery-notes/delivery-notes.module';
import { InvoiceTemplatesModule } from './invoice-templates/invoice-templates.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { EmailModule } from './email/email.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';
import { CreditNotesModule } from './credit-notes/credit-notes.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { TaxModule } from './tax/tax.module';
import { CrmModule } from './crm/crm.module';
import { PosModule } from './pos/pos.module';
import { HrModule } from './hr/hr.module';
import { MeteraiModule } from './meterai/meterai.module';
import { MarketplaceModule } from './marketplace/marketplace.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    PdfModule,
    AuthModule,
    BusinessModule,
    CustomersModule,
    ProductsModule,
    InvoicesModule,
    PaymentsModule,
    ReportsModule,
    InvoiceNumberingModule,
    DeleteRequestsModule,
    LegalHoldsModule,
    ReceivablesModule,
    RemindersModule,
    WhatsAppModule,
    PaymentGatewayModule,
    RolesModule,
    RecurringModule,
    AuditModule,
    QuotationsModule,
    ExpensesModule,
    DeliveryNotesModule,
    InvoiceTemplatesModule,
    CustomFieldsModule,
    EmailModule,
    SalesOrdersModule,
    CreditNotesModule,
    PurchaseOrdersModule,
    TaxModule,
    CrmModule,
    PosModule,
    HrModule,
    MeteraiModule,
    MarketplaceModule,
  ],
})
export class AppModule {}
