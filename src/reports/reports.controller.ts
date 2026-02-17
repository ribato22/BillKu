import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/dashboard
   * Get dashboard summary
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: CurrentUserData) {
    const data = await this.reportsService.getDashboard(user.businessId);
    return { data };
  }

  /**
   * GET /reports/revenue
   * Get revenue report
   */
  @Get('revenue')
  async getRevenueReport(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.reportsService.getRevenueReport(user.businessId, {
      startDate,
      endDate,
    });
    return { data };
  }

  /**
   * GET /reports/aging
   * Get aging report
   */
  @Get('aging')
  async getAgingReport(@CurrentUser() user: CurrentUserData) {
    const data = await this.reportsService.getAgingReport(user.businessId);
    return { data };
  }

  /**
   * GET /reports/export/invoices
   * Export invoices as CSV
   */
  @Get('export/invoices')
  async exportInvoices(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    const { csv, count } = await this.reportsService.exportInvoicesCSV(
      user.businessId,
      { startDate, endDate, status },
    );

    if (res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      return res.send(csv);
    }

    return { data: { csv, count } };
  }

  /**
   * GET /reports/chart-data
   * Get chart data for dashboard visualization
   */
  @Get('chart-data')
  async getChartData(
    @CurrentUser() user: CurrentUserData,
    @Query('months') months?: string,
  ) {
    const data = await this.reportsService.getChartData(
      user.businessId,
      months ? parseInt(months, 10) : 6,
    );
    return { data };
  }

  /**
   * GET /reports/recent-invoices
   * Get recent invoices for dashboard
   */
  @Get('recent-invoices')
  async getRecentInvoices(
    @CurrentUser() user: CurrentUserData,
    @Query('limit') limit?: string,
  ) {
    const data = await this.reportsService.getRecentInvoices(
      user.businessId,
      limit ? parseInt(limit, 10) : 5,
    );
    return { data };
  }

  /**
   * GET /reports/profit-loss
   * Profit & Loss statement
   */
  @Get('profit-loss')
  async getProfitLoss(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.reportsService.getProfitLoss(user.businessId, { from, to });
    return { data };
  }

  /**
   * GET /reports/balance-sheet
   * Simplified balance sheet
   */
  @Get('balance-sheet')
  async getBalanceSheet(@CurrentUser() user: CurrentUserData) {
    const data = await this.reportsService.getBalanceSheet(user.businessId);
    return { data };
  }

  /**
   * GET /reports/cash-flow
   * Cash Flow Statement
   */
  @Get('cash-flow')
  async getCashFlow(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.reportsService.getCashFlowStatement(user.businessId, { from, to });
    return { data };
  }

  /**
   * GET /reports/general-ledger
   * General Ledger (Buku Besar)
   */
  @Get('general-ledger')
  async getGeneralLedger(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.reportsService.getGeneralLedger(user.businessId, {
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return { data };
  }
}
