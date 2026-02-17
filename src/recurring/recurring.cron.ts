import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringService } from './recurring.service';

@Injectable()
export class RecurringCron {
  private readonly logger = new Logger(RecurringCron.name);

  constructor(private readonly recurringService: RecurringService) {}

  /**
   * Run daily at 6:00 AM — process all due recurring invoices
   */
  @Cron('0 6 * * *')
  async handleDailyRecurring() {
    this.logger.log('Processing due recurring invoices...');
    try {
      const results = await this.recurringService.processAllDue();
      const successCount = results.filter((r) => r.status === 'success').length;
      const errorCount = results.filter((r) => r.status === 'error').length;
      this.logger.log(
        `Recurring invoices processed: ${successCount} success, ${errorCount} errors`,
      );
      if (errorCount > 0) {
        const errors = results.filter((r) => r.status === 'error');
        this.logger.warn('Recurring invoice errors:', errors);
      }
    } catch (error) {
      this.logger.error('Failed to process recurring invoices', error);
    }
  }
}
