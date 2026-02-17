import { Module } from '@nestjs/common';
import { MeteraiService } from './meterai.service';
import { MeteraiController } from './meterai.controller';

@Module({
  controllers: [MeteraiController],
  providers: [MeteraiService],
  exports: [MeteraiService],
})
export class MeteraiModule {}
