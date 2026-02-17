import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get business by ID
   */
  async findOne(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        defaultCurrency: true,
        invoiceNumberRule: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return {
      id: business.id,
      name: business.name,
      email: business.email,
      phone: business.phone,
      address: business.address,
      city: business.city,
      state: business.state,
      postalCode: business.postalCode,
      country: business.country,
      taxId: business.taxId,
      website: business.website,
      logoUrl: business.logoUrl,
      bankName: business.bankName,
      bankAccountNumber: business.bankAccountNumber,
      bankAccountName: business.bankAccountName,
      defaultCurrencyCode: business.defaultCurrencyCode,
      defaultCurrency: business.defaultCurrency
        ? {
            code: business.defaultCurrency.code,
            name: business.defaultCurrency.name,
            symbol: business.defaultCurrency.symbol,
          }
        : null,
      invoiceNumbering: business.invoiceNumberRule
        ? {
            pattern: business.invoiceNumberRule.pattern,
            resetPeriod: business.invoiceNumberRule.resetPeriod,
          }
        : null,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  /**
   * Update business
   */
  async update(businessId: string, data: UpdateBusinessDto) {
    // Verify business exists
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException('Business not found');
    }

    // If updating currency, verify it exists
    if (data.defaultCurrencyCode) {
      const currency = await this.prisma.currency.findUnique({
        where: { code: data.defaultCurrencyCode },
      });

      if (!currency) {
        throw new BadRequestException(
          `Currency ${data.defaultCurrencyCode} not found`,
        );
      }
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        taxId: data.taxId,
        website: data.website,
        logoUrl: data.logoUrl,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName,
        defaultCurrencyCode: data.defaultCurrencyCode,
      },
      include: {
        defaultCurrency: true,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      city: updated.city,
      state: updated.state,
      postalCode: updated.postalCode,
      country: updated.country,
      taxId: updated.taxId,
      website: updated.website,
      logoUrl: updated.logoUrl,
      bankName: updated.bankName,
      bankAccountNumber: updated.bankAccountNumber,
      bankAccountName: updated.bankAccountName,
      defaultCurrencyCode: updated.defaultCurrencyCode,
      defaultCurrency: updated.defaultCurrency
        ? {
            code: updated.defaultCurrency.code,
            name: updated.defaultCurrency.name,
            symbol: updated.defaultCurrency.symbol,
          }
        : null,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Get available currencies
   */
  async getCurrencies() {
    return this.prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });
  }
}
