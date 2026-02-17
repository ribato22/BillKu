import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';

@Module({
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
