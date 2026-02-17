import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('pos')
@UseGuards(JwtAuthGuard)
export class PosController {
  constructor(private readonly service: PosService) {}

  // Sessions
  @Post('sessions/open')
  async openSession(@CurrentUser() user: CurrentUserData, @Body() dto: any) {
    const sessionDto = {
      cashierId: dto.cashierId || user.userId,
      cashierName: dto.cashierName || user.email,
      openingCash: dto.openingCash,
    };
    const data = await this.service.openSession(user.businessId, sessionDto);
    return { data: { ...data, openingCash: Number(data.openingCash) } };
  }

  @Post('sessions/:id/close')
  async closeSession(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() body: { closingCash?: number }) {
    const data = await this.service.closeSession(user.businessId, id, body.closingCash);
    return { data };
  }

  @Get('sessions/active')
  async getActiveSession(@CurrentUser() user: CurrentUserData, @Query('cashierId') cashierId?: string) {
    const data = await this.service.getActiveSession(user.businessId, cashierId || user.userId);
    return { data };
  }

  @Get('sessions')
  async getSessions(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getSessions(user.businessId, query);
  }

  // Transactions
  @Post('sessions/:sessionId/transactions')
  async createTransaction(@CurrentUser() user: CurrentUserData, @Param('sessionId') sessionId: string, @Body() dto: any) {
    const data = await this.service.createTransaction(user.businessId, sessionId, dto);
    return { data };
  }

  @Get('sessions/:sessionId/transactions')
  async getTransactions(@CurrentUser() user: CurrentUserData, @Param('sessionId') sessionId: string) {
    const data = await this.service.getTransactions(user.businessId, sessionId);
    return { data };
  }

  // Product lookup for POS
  @Get('products/search')
  async searchProducts(@CurrentUser() user: CurrentUserData, @Query('q') q: string) {
    const data = await this.service.searchProducts(user.businessId, q || '');
    return { data };
  }
}
