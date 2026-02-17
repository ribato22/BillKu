import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('receivables')
@UseGuards(JwtAuthGuard)
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  /**
   * GET /receivables/summary
   * Get total outstanding and overdue amounts
   */
  @Get('summary')
  async getSummary(@CurrentUser() user: CurrentUserData) {
    const summary = await this.receivablesService.getSummary(user.businessId);
    return { data: summary };
  }

  /**
   * GET /receivables/aging
   * Get aging buckets report
   */
  @Get('aging')
  async getAging(@CurrentUser() user: CurrentUserData) {
    const aging = await this.receivablesService.getAging(user.businessId);
    return { data: aging };
  }
}
