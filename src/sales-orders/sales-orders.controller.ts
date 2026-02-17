import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('sales-orders')
@UseGuards(JwtAuthGuard)
export class SalesOrdersController {
  constructor(private readonly service: SalesOrdersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.businessId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.findOne(user.businessId, id);
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateSalesOrderDto) {
    const data = await this.service.create(user.businessId, dto);
    return { data };
  }

  @Patch(':id')
  async update(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    const data = await this.service.update(user.businessId, id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.remove(user.businessId, id);
  }

  @Post(':id/convert-to-invoice')
  async convertToInvoice(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.convertToInvoice(user.businessId, id);
  }
}
