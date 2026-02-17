import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceType } from '@prisma/client';

@Injectable()
export class LegalHoldsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List legal holds for a business
   */
  async findAll(
    businessId: string,
    options?: {
      activeOnly?: boolean;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      businessId,
      ...(options?.activeOnly && { releasedAt: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.legalHold.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true } },
          releasedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.legalHold.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  /**
   * Get a single legal hold
   */
  async findOne(id: string, businessId: string) {
    const hold = await this.prisma.legalHold.findFirst({
      where: { id, businessId },
      include: {
        createdBy: { select: { id: true, email: true } },
        releasedBy: { select: { id: true, email: true } },
      },
    });

    if (!hold) {
      throw new NotFoundException('Legal hold not found');
    }

    return hold;
  }

  /**
   * Check if a resource has an active legal hold
   */
  async hasActiveHold(
    businessId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const hold = await this.prisma.legalHold.findFirst({
      where: {
        businessId,
        resourceType,
        resourceId,
        releasedAt: null,
      },
    });

    return !!hold;
  }

  /**
   * Create a new legal hold
   */
  async create(
    businessId: string,
    userId: string | null,
    data: {
      resourceType: ResourceType;
      resourceId: string;
      reason?: string;
      endAt?: string;
    },
  ) {
    // Check if there's already an active hold on this resource
    const existingHold = await this.prisma.legalHold.findFirst({
      where: {
        businessId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        releasedAt: null,
      },
    });

    if (existingHold) {
      throw new BadRequestException({
        code: 'LEGAL_HOLD_ALREADY_EXISTS',
        message: 'An active legal hold already exists for this resource',
      });
    }

    return this.prisma.legalHold.create({
      data: {
        businessId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        reason: data.reason,
        endAt: data.endAt ? new Date(data.endAt) : null,
        createdByUserId: userId,
      },
    });
  }

  /**
   * Release a legal hold
   */
  async release(id: string, businessId: string, userId: string | null) {
    const hold = await this.findOne(id, businessId);

    if (hold.releasedAt) {
      throw new BadRequestException({
        code: 'LEGAL_HOLD_ALREADY_RELEASED',
        message: 'This legal hold has already been released',
      });
    }

    return this.prisma.legalHold.update({
      where: { id },
      data: {
        releasedAt: new Date(),
        releasedByUserId: userId,
      },
    });
  }
}
