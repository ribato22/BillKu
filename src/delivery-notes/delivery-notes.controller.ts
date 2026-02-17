import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DeliveryNotesService } from './delivery-notes.service';
import { CreateDeliveryNoteDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

@Controller('delivery-notes')
@UseGuards(JwtAuthGuard)
export class DeliveryNotesController {
  constructor(
    private readonly deliveryNotesService: DeliveryNotesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserData) {
    const data = await this.deliveryNotesService.findAll(user.businessId);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.deliveryNotesService.findOne(user.businessId, id);
    return { data };
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateDeliveryNoteDto,
  ) {
    const data = await this.deliveryNotesService.create(user.businessId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'delivery-note',
      resourceId: data.id,
      changes: { recipient: dto.recipient, items: dto.items.length },
    });
    return { data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.deliveryNotesService.remove(user.businessId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'delivery-note',
      resourceId: id,
    });
    return { data: { success: true } };
  }
}
