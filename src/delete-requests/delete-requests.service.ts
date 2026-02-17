import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceType, DeleteRequestStatus } from '@prisma/client';

@Injectable()
export class DeleteRequestsService {
  constructor(private prisma: PrismaService) {}

  /**
   * List delete requests for a business
   */
  async findAll(
    businessId: string,
    options?: {
      status?: DeleteRequestStatus;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      businessId,
      ...(options?.status && { status: options.status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.deleteRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { requestedAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, email: true } },
          reviewedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.deleteRequest.count({ where }),
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
   * Get a single delete request
   */
  async findOne(id: string, businessId: string) {
    const request = await this.prisma.deleteRequest.findFirst({
      where: { id, businessId },
      include: {
        requestedBy: { select: { id: true, email: true } },
        reviewedBy: { select: { id: true, email: true } },
        processedBy: { select: { id: true, email: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Delete request not found');
    }

    return request;
  }

  /**
   * Create a new delete request
   */
  async create(
    businessId: string,
    userId: string | null,
    data: {
      resourceType: ResourceType;
      resourceId: string;
      reason?: string;
    },
  ) {
    // Check if there's an active legal hold on this resource
    const legalHold = await this.prisma.legalHold.findFirst({
      where: {
        businessId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        releasedAt: null,
      },
    });

    if (legalHold) {
      throw new BadRequestException({
        code: 'DELETE_BLOCKED_LEGAL_HOLD',
        message:
          'Cannot request deletion: resource has an active legal hold',
      });
    }

    // Check if there's already a pending request for this resource
    const existing = await this.prisma.deleteRequest.findFirst({
      where: {
        businessId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        status: 'pending',
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'DELETE_REQUEST_ALREADY_EXISTS',
        message: 'A pending delete request already exists for this resource',
      });
    }

    return this.prisma.deleteRequest.create({
      data: {
        businessId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        reason: data.reason,
        requestedByUserId: userId,
      },
    });
  }

  /**
   * Update delete request status (approve/reject/cancel)
   */
  async updateStatus(
    id: string,
    businessId: string,
    userId: string | null,
    newStatus: DeleteRequestStatus,
  ) {
    const request = await this.findOne(id, businessId);

    // Validate status transition
    if (request.status !== 'pending') {
      throw new BadRequestException({
        code: 'DELETE_ALREADY_PROCESSED',
        message: `Cannot update: request is already ${request.status}`,
      });
    }

    if (newStatus === 'pending') {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot transition to pending status',
      });
    }

    // Check legal hold again for approval
    if (newStatus === 'approved') {
      const legalHold = await this.prisma.legalHold.findFirst({
        where: {
          businessId,
          resourceType: request.resourceType,
          resourceId: request.resourceId,
          releasedAt: null,
        },
      });

      if (legalHold) {
        throw new BadRequestException({
          code: 'DELETE_BLOCKED_LEGAL_HOLD',
          message: 'Cannot approve: resource has an active legal hold',
        });
      }
    }

    return this.prisma.deleteRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  }
}
