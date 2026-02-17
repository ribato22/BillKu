import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit-logs
   * Get paginated audit logs with optional filters
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.auditService.findAll(user.businessId, {
      resource,
      action,
      from,
      to,
      page,
      limit,
    });
    return { data: result.data, pagination: result.pagination };
  }
}
