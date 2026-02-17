import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TaxService } from './tax.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * GET /tax/summary
   * PPN Tax Summary with monthly breakdown
   */
  @Get('summary')
  async getTaxSummary(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.taxService.getTaxSummary(user.businessId, { from, to });
    return { data };
  }

  /**
   * GET /tax/efaktur-export
   * Generate e-Faktur CSV for DJP import
   */
  @Get('efaktur-export')
  async exportEFaktur(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const result = await this.taxService.generateEFakturCSV(user.businessId, { from, to });

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="efaktur-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      return res.send(result.csv);
    }

    return { data: result };
  }
}
