import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { ReminderLogStatus } from '@prisma/client';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  /**
   * Run every day at 9 AM to process auto-reminders
   */
  @Cron('0 9 * * *') // Every day at 9:00 AM
  async processAutoReminders() {
    this.logger.log('Starting auto-reminder processing...');

    // Get all active schedules grouped by business
    const schedules = await this.prisma.reminderSchedule.findMany({
      where: { isActive: true },
      include: { business: true },
    });

    for (const schedule of schedules) {
      try {
        await this.processSchedule(schedule);
      } catch (error) {
        this.logger.error(
          `Error processing schedule ${schedule.id}: ${error.message}`,
        );
      }
    }

    this.logger.log('Auto-reminder processing completed');
  }

  /**
   * Process a single schedule
   */
  private async processSchedule(schedule: {
    id: string;
    businessId: string;
    triggerDays: number;
    template: string;
  }) {
    // Calculate target date based on trigger days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + schedule.triggerDays);

    // Find invoices with due date matching target
    // triggerDays = -3 means 3 days before due, so we look for dueDate = today + 3
    // triggerDays = 1 means 1 day after due (overdue), so we look for dueDate = today - 1
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId: schedule.businessId,
        status: { in: ['sent', 'partial'] }, // Only unpaid/partially paid
        dueDate: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000), // Same day
        },
      },
      include: { customer: true, business: true },
    });

    this.logger.log(
      `Schedule ${schedule.id}: Found ${invoices.length} invoices for trigger D${schedule.triggerDays >= 0 ? '+' : ''}${schedule.triggerDays}`,
    );

    for (const invoice of invoices) {
      // Skip if no phone number
      if (!invoice.customer.phone) {
        this.logger.warn(
          `Skipping invoice ${invoice.id}: customer has no phone`,
        );
        continue;
      }

      // Check if already sent today for this schedule
      const existingLog = await this.prisma.reminderLog.findFirst({
        where: {
          invoiceId: invoice.id,
          scheduleId: schedule.id,
          createdAt: { gte: today },
        },
      });

      if (existingLog) {
        this.logger.log(
          `Skipping invoice ${invoice.id}: reminder already sent today`,
        );
        continue;
      }

      // Build message from template
      const message = this.buildMessage(schedule.template, invoice);

      // Create pending log
      const log = await this.prisma.reminderLog.create({
        data: {
          scheduleId: schedule.id,
          invoiceId: invoice.id,
          phoneNumber: invoice.customer.phone,
          message,
          status: ReminderLogStatus.PENDING,
        },
      });

      // Send message
      const result = await this.whatsAppService.sendMessage(
        schedule.businessId,
        invoice.customer.phone,
        message,
      );

      // Update log status
      await this.prisma.reminderLog.update({
        where: { id: log.id },
        data: {
          status: result.success
            ? ReminderLogStatus.SENT
            : ReminderLogStatus.FAILED,
          sentAt: result.success ? new Date() : null,
          error: result.error,
        },
      });

      this.logger.log(
        `Invoice ${invoice.id}: ${result.success ? 'Sent' : 'Failed'} - ${result.error || 'OK'}`,
      );
    }
  }

  /**
   * Build message from template with invoice variables
   */
  private buildMessage(
    template: string,
    invoice: {
      invoiceNumber: string;
      total: bigint;
      dueDate: Date;
      customer: { name: string };
      business: { name: string };
    },
  ): string {
    const variables: Record<string, string> = {
      customer_name: invoice.customer.name,
      invoice_number: invoice.invoiceNumber,
      amount: this.formatCurrency(invoice.total),
      due_date: invoice.dueDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      business_name: invoice.business.name,
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }

  private formatCurrency(amount: bigint): string {
    return new Intl.NumberFormat('id-ID').format(Number(amount));
  }
}
