import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  // ======================== DEALS ========================

  @Get('deals')
  async getDeals(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getDeals(user.businessId, query);
  }

  @Get('deals/pipeline')
  async getDealPipeline(@CurrentUser() user: CurrentUserData) {
    const data = await this.service.getDealPipeline(user.businessId);
    return { data };
  }

  @Get('deals/:id')
  async getDealById(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.getDealById(user.businessId, id);
    return { data };
  }

  @Post('deals')
  async createDeal(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const data = await this.service.createDeal(user.businessId, dto);
    return { data };
  }

  @Patch('deals/:id')
  async updateDeal(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: any) {
    const data = await this.service.updateDeal(user.businessId, id, dto);
    return { data };
  }

  @Delete('deals/:id')
  async deleteDeal(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.deleteDeal(user.businessId, id);
  }

  // ======================== ACTIVITIES ========================

  @Get('activities')
  async getActivities(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getActivities(user.businessId, query);
  }

  @Post('activities')
  async createActivity(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const data = await this.service.createActivity(user.businessId, dto);
    return { data };
  }

  @Post('activities/:id/complete')
  async completeActivity(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.completeActivity(user.businessId, id);
    return { data };
  }

  @Delete('activities/:id')
  async deleteActivity(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.deleteActivity(user.businessId, id);
  }

  // ======================== TAGS ========================

  @Get('customers/:customerId/tags')
  async getCustomerTags(@CurrentUser() user: CurrentUserData, @Param('customerId') customerId: string) {
    const data = await this.service.getCustomerTags(user.businessId, customerId);
    return { data };
  }

  @Post('customers/:customerId/tags')
  async addTag(@CurrentUser() user: CurrentUserData, @Param('customerId') customerId: string, @Body() body: { tag: string }) {
    const data = await this.service.addCustomerTag(user.businessId, customerId, body.tag);
    return { data };
  }

  @Delete('customers/:customerId/tags/:tag')
  async removeTag(@CurrentUser() user: CurrentUserData, @Param('customerId') customerId: string, @Param('tag') tag: string) {
    return this.service.removeCustomerTag(user.businessId, customerId, tag);
  }
}
