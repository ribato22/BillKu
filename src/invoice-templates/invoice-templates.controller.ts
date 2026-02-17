import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InvoiceTemplatesService } from './invoice-templates.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('invoice-templates')
@UseGuards(JwtAuthGuard)
export class InvoiceTemplatesController {
  constructor(private readonly service: InvoiceTemplatesService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserData) {
    const data = await this.service.findAll(user.businessId);
    return { data };
  }

  @Get('default')
  async getDefault(@CurrentUser() user: CurrentUserData) {
    const data = await this.service.getDefault(user.businessId);
    return { data };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.service.findOne(user.businessId, id);
    return { data };
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateInvoiceTemplateDto,
  ) {
    const data = await this.service.create(user.businessId, dto);
    return { data };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceTemplateDto,
  ) {
    const data = await this.service.update(user.businessId, id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.service.remove(user.businessId, id);
    return { data };
  }


}
