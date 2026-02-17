import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  // Connections
  @Get('connections')
  async getConnections(@CurrentUser() user: CurrentUserData) {
    const data = await this.service.getConnections(user.businessId);
    return { data };
  }

  @Post('connections')
  async connectPlatform(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const data = await this.service.connectPlatform(user.businessId, dto);
    return { data };
  }

  @Delete('connections/:id')
  async disconnectPlatform(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.disconnectPlatform(user.businessId, id);
  }

  @Post('connections/:id/tokens')
  async updateTokens(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: any) {
    const data = await this.service.updateTokens(user.businessId, id, dto);
    return { data };
  }

  // Orders
  @Post('connections/:id/sync')
  async syncOrders(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() body: { orders: any[] }) {
    const data = await this.service.syncOrders(user.businessId, id, body.orders);
    return { data };
  }

  @Get('orders')
  async getOrders(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getOrders(user.businessId, query);
  }

  @Post('orders/:id/convert-to-invoice')
  async convertToInvoice(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const data = await this.service.convertOrderToInvoice(user.businessId, id);
    return { data };
  }

  // Dashboard
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: CurrentUserData) {
    const data = await this.service.getDashboard(user.businessId);
    return { data };
  }
}
