import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { ReminderType } from '@prisma/client';

@Controller('settings/reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /**
   * GET /settings/reminders
   * Get all reminder templates
   */
  @Get()
  async getTemplates(@CurrentUser() user: CurrentUserData) {
    const templates = await this.remindersService.getTemplates(user.businessId);
    return { data: templates };
  }

  /**
   * PUT /settings/reminders/:type
   * Update a reminder template (type: H_MINUS_3 or OVERDUE)
   */
  @Put(':type')
  async updateTemplate(
    @CurrentUser() user: CurrentUserData,
    @Param('type') type: string,
    @Body() body: { template: string },
  ) {
    const template = await this.remindersService.upsertTemplate(
      user.businessId,
      type as ReminderType,
      body,
    );
    return { data: template };
  }

  /**
   * GET /settings/reminders/preview
   * Preview invoices that would receive reminders
   */
  @Get('preview')
  async previewReminders(@CurrentUser() user: CurrentUserData) {
    const invoices = await this.remindersService.getInvoicesDueForReminder(
      user.businessId,
    );
    return { data: invoices };
  }
}
