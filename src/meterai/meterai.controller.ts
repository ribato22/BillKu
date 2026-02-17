import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { MeteraiService } from './meterai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('meterai')
@UseGuards(JwtAuthGuard)
export class MeteraiController {
  constructor(private readonly service: MeteraiService) {}

  @Post('stamp')
  async requestMeterai(@CurrentUser() user: CurrentUserData, @Body() dto: { documentType: string; documentId: string }) {
    const data = await this.service.requestMeterai(user.businessId, dto);
    return { data };
  }

  @Get('history')
  async getHistory(@CurrentUser() user: CurrentUserData, @Query() query: any) {
    return this.service.getMeteraiHistory(user.businessId, query);
  }

  @Get('stats')
  async getStats(@CurrentUser() user: CurrentUserData, @Query('period') period?: string) {
    const data = await this.service.getMeteraiStats(user.businessId, period);
    return { data };
  }

  @Get('verify/:serialNumber')
  async verify(@CurrentUser() user: CurrentUserData, @Param('serialNumber') serialNumber: string) {
    const data = await this.service.verifyMeterai(user.businessId, serialNumber);
    return { data };
  }
}
