import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * List customers for a business with pagination
   */
  async findAll(
    businessId: string,
    options: { page?: number; pageSize?: number; search?: string } = {},
  ) {
    const { page = 1, pageSize = 20, search } = options;
    const skip = (page - 1) * pageSize;

    const where = {
      businessId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { page, pageSize, total },
    };
  }

  /**
   * Get customer by ID
   */
  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId, deletedAt: null },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  /**
   * Create a new customer
   */
  async create(businessId: string, data: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        businessId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });
  }

  /**
   * Update a customer
   */
  async update(businessId: string, id: string, data: UpdateCustomerDto) {
    // Verify customer exists and belongs to business
    const existing = await this.prisma.customer.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });
  }

  /**
   * Soft delete a customer
   */
  async remove(businessId: string, id: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    // Soft delete
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
