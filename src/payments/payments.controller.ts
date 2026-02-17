import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { AuditService } from '../audit/audit.service';

/**
 * Standalone payments controller for GET /payments (all payments for business)
 */
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsListController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserData) {
    const payments = await this.paymentsService.findAll(user.businessId);
    return { data: payments };
  }
}

@Controller('invoices/:invoiceId/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /invoices/:invoiceId/payments
   * List payments for an invoice
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
  ) {
    const payments = await this.paymentsService.findByInvoice(
      user.businessId,
      invoiceId,
    );
    return { data: payments };
  }

  /**
   * GET /invoices/:invoiceId/payments/summary
   * Get payment summary
   */
  @Get('summary')
  async getSummary(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
  ) {
    const summary = await this.paymentsService.getSummary(
      user.businessId,
      invoiceId,
    );
    return { data: summary };
  }

  /**
   * POST /invoices/:invoiceId/payments
   * Record a payment
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    const payment = await this.paymentsService.create(user.businessId, invoiceId, dto);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'create',
      resource: 'payment',
      resourceId: payment.id,
      changes: { invoiceId, amount: dto.amount, method: dto.method },
    });
    return { data: payment };
  }

  /**
   * DELETE /invoices/:invoiceId/payments/:id
   * Delete a payment
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserData,
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
  ) {
    await this.paymentsService.remove(user.businessId, invoiceId, id);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'delete',
      resource: 'payment',
      resourceId: id,
      changes: { invoiceId },
    });
    return { data: { success: true } };
  }
}
