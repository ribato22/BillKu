import { Module } from '@nestjs/common';
import { LegalHoldsService } from './legal-holds.service';
import { LegalHoldsController } from './legal-holds.controller';

@Module({
  providers: [LegalHoldsService],
  controllers: [LegalHoldsController],
  exports: [LegalHoldsService],
})
export class LegalHoldsModule {}
