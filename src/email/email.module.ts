import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailConfigController } from './email-config.controller';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';

@Global()
@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [NotificationsController, EmailConfigController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

