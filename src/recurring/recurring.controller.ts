import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { RecurringFrequency } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Controller('recurring-invoices')
@UseGuards(JwtAuthGuard)
export class RecurringController {
  constructor(
    private readonly recurringService: RecurringService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /recurring-invoices — List all recurring templates
   */
  @Get()
  async list(@CurrentUser() user: CurrentUserData) {
    const data = await this.recurringService.list(user.businessId);
    return { data };
  }

  /**
   * GET /recurring-invoices/:id — Get detail
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const data = await this.recurringService.findOne(id, user.businessId);
    return { data };
  }

  /**
   * POST /recurring-invoices — Create recurring template
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body()
    body: {
      customerId: string;
      frequency: RecurringFrequency;
      nextDueDate: string;
      dueDayOffset?: number;
      currencyCode?: string;
      taxEnabled?: boolean;
      taxRateBps?: number;
      items: {
        productId?: string;
        description: string;
        qty?: number;
        unitPrice: number;
      }[];
    },
  ) {
    const data = await this.recurringService.create(user.businessId, body);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'recurring-invoice',
      resourceId: data.id,
      changes: { frequency: body.frequency, customerId: body.customerId },
    });
    return { data };
  }

  /**
   * PATCH /recurring-invoices/:id — Update
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body()
    body: {
      frequency?: RecurringFrequency;
      nextDueDate?: string;
      dueDayOffset?: number;
      isActive?: boolean;
      taxEnabled?: boolean;
      taxRateBps?: number;
    },
  ) {
    const data = await this.recurringService.update(id, user.businessId, body);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update',
      resource: 'recurring-invoice',
      resourceId: id,
      changes: body as unknown as Record<string, unknown>,
    });
    return { data };
  }

  /**
   * DELETE /recurring-invoices/:id — Deactivate
   */
  @Delete(':id')
  async delete(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.recurringService.delete(id, user.businessId);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'recurring-invoice',
      resourceId: id,
    });
    return { data: { message: 'Recurring invoice dinonaktifkan' } };
  }

  /**
   * POST /recurring-invoices/:id/generate — Manual trigger
   */
  @Post(':id/generate')
  async generate(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    const invoice = await this.recurringService.generateInvoice(
      id,
      user.businessId,
    );
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'generate',
      resource: 'recurring-invoice',
      resourceId: id,
      changes: { generatedInvoiceId: invoice.id },
    });
    return { data: invoice };
  }
}
