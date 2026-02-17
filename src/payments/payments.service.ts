import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto';
import { PaymentMethod } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}
  /**
   * List all payments for a business
   */
  async findAll(businessId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { businessId },
      },
      include: {
        invoice: {
          select: { id: true, invoiceNumber: true, status: true, total: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      invoice: p.invoice
        ? { ...p.invoice, total: Number(p.invoice.total) }
        : null,
    }));
  }

  /**
   * List payments for an invoice
   */
  async findByInvoice(businessId: string, invoiceId: string) {
    // Verify invoice belongs to business
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const payments = await this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { date: 'desc' },
    });

    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  }

  /**
   * Record a payment for an invoice
   */
  async create(businessId: string, invoiceId: string, data: CreatePaymentDto) {
    // Verify invoice belongs to business
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only reject payments on already-paid invoices
    if (invoice.status === 'paid') {
      throw new BadRequestException(
        'Cannot add payment to an already paid invoice',
      );
    }

    // Calculate total paid so far
    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const remaining = Number(invoice.total) - totalPaid;

    if (data.amount > remaining) {
      throw new BadRequestException(
        `Payment amount exceeds remaining balance (${remaining})`,
      );
    }

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoiceId,
        date: new Date(data.date),
        amount: BigInt(data.amount),
        currencyCode: invoice.currencyCode,
        method: data.method as PaymentMethod,
        note: data.note,
      },
    });

    // Auto-update invoice status
    const newTotalPaid = totalPaid + data.amount;
    if (newTotalPaid >= Number(invoice.total)) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'paid' },
      });
    } else if (newTotalPaid > 0) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'partial' },
      });
    }

    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }

  /**
   * Delete a payment
   */
  async remove(businessId: string, invoiceId: string, paymentId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, invoiceId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.prisma.payment.delete({ where: { id: paymentId } });

    // Revert invoice status if needed
    if (invoice.status === 'paid' || invoice.status === 'partial') {
      const remainingPayments = await this.prisma.payment.findMany({
        where: { invoiceId },
      });
      const totalPaid = remainingPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      if (totalPaid === 0) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'sent' },
        });
      } else if (totalPaid < Number(invoice.total)) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'partial' },
        });
      }
    }

    return { success: true };
  }

  /**
   * Get payment summary for an invoice
   */
  async getSummary(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const total = Number(invoice.total);
    const remaining = total - totalPaid;

    return {
      invoiceId,
      total,
      totalPaid,
      remaining,
      isPaid: remaining <= 0,
      paymentCount: invoice.payments.length,
    };
  }
}
