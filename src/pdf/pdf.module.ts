import { Module, Global } from '@nestjs/common';
import { PdfService } from './pdf.service';

@Global()
@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
