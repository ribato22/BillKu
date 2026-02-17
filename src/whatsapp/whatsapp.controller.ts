import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { WhatsAppService } from './whatsapp.service';
import {
  SendMessageDto,
  CreateReminderScheduleDto,
  UpdateReminderScheduleDto,
} from './dto';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  /**
   * POST /whatsapp/connect
   * Start WhatsApp connection, returns QR code if needed
   */
  @Post('connect')
  async connect(@CurrentUser() user: CurrentUserData) {
    const result = await this.whatsAppService.connect(user.businessId);
    return { data: result };
  }

  /**
   * GET /whatsapp/qr
   * Get current QR code (if awaiting scan)
   */
  @Get('qr')
  getQRCode(@CurrentUser() user: CurrentUserData) {
    const qr = this.whatsAppService.getQRCode(user.businessId);
    return { data: { qr } };
  }

  /**
   * GET /whatsapp/status
   * Get connection status
   */
  @Get('status')
  async getStatus(@CurrentUser() user: CurrentUserData) {
    const status = await this.whatsAppService.getStatus(user.businessId);
    return { data: status };
  }

  /**
   * POST /whatsapp/disconnect
   * Disconnect and clear session
   */
  @Post('disconnect')
  async disconnect(@CurrentUser() user: CurrentUserData) {
    await this.whatsAppService.disconnect(user.businessId);
    return { message: 'Disconnected successfully' };
  }

  /**
   * POST /whatsapp/send
   * Send a message manually
   */
  @Post('send')
  async sendMessage(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.whatsAppService.sendMessage(
      user.businessId,
      dto.phoneNumber,
      dto.message,
    );
    return { data: result };
  }

  /**
   * POST /whatsapp/invoices/:invoiceId/remind
   * Send reminder for specific invoice
   */
  @Post('invoices/:invoiceId/remind')
  async sendReminder(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { template?: string },
  ) {
    const result = await this.whatsAppService.sendInvoiceReminder(
      user.businessId,
      invoiceId,
      body.template,
    );
    return { data: result };
  }

  /**
   * GET /whatsapp/invoices/:invoiceId/reminder-logs
   * Get reminder history for an invoice
   */
  @Get('invoices/:invoiceId/reminder-logs')
  async getReminderLogs(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
  ) {
    const logs = await this.whatsAppService.getReminderLogs(
      invoiceId,
      user.businessId,
    );
    return { data: logs };
  }

  // ===== Reminder Schedules =====

  /**
   * GET /whatsapp/reminder-schedules
   * List all reminder schedules
   */
  @Get('reminder-schedules')
  async listSchedules(@CurrentUser() user: CurrentUserData) {
    const schedules = await this.whatsAppService.listReminderSchedules(
      user.businessId,
    );
    return { data: schedules };
  }

  /**
   * POST /whatsapp/reminder-schedules
   * Create a reminder schedule
   */
  @Post('reminder-schedules')
  async createSchedule(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateReminderScheduleDto,
  ) {
    const schedule = await this.whatsAppService.createReminderSchedule(
      user.businessId,
      dto.triggerDays,
      dto.template,
    );
    return { data: schedule };
  }

  /**
   * PATCH /whatsapp/reminder-schedules/:id
   * Update a reminder schedule
   */
  @Patch('reminder-schedules/:id')
  async updateSchedule(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateReminderScheduleDto,
  ) {
    const schedule = await this.whatsAppService.updateReminderSchedule(
      id,
      user.businessId,
      dto,
    );
    return { data: schedule };
  }

  /**
   * DELETE /whatsapp/reminder-schedules/:id
   * Delete a reminder schedule
   */
  @Delete('reminder-schedules/:id')
  async deleteSchedule(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.whatsAppService.deleteReminderSchedule(id, user.businessId);
    return { message: 'Schedule deleted' };
  }
}
