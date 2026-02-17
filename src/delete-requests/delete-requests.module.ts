import { Module } from '@nestjs/common';
import { DeleteRequestsService } from './delete-requests.service';
import { DeleteRequestsController } from './delete-requests.controller';

@Module({
  providers: [DeleteRequestsService],
  controllers: [DeleteRequestsController],
  exports: [DeleteRequestsService],
})
export class DeleteRequestsModule {}
