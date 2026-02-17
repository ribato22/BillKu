import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * List team members for a business
   */
  async listMembers(businessId: string) {
    return this.prisma.businessMember.findMany({
      where: { businessId },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invite a user to a business (create if not exists)
   */
  async inviteMember(
    businessId: string,
    email: string,
    role: UserRole,
    invitedBy: string,
  ) {
    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Create a placeholder user — they'll set password on first login
      const bcrypt = await import('bcrypt');
      const tempHash = await bcrypt.hash(
        Math.random().toString(36).slice(2),
        10,
      );
      user = await this.prisma.user.create({
        data: { email, passwordHash: tempHash },
      });
    }

    // Create membership
    return this.prisma.businessMember.create({
      data: {
        businessId,
        userId: user.id,
        role,
        invitedBy,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(memberId: string, businessId: string, role: UserRole) {
    return this.prisma.businessMember.update({
      where: { id: memberId, businessId },
      data: { role },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Remove a team member
   */
  async removeMember(memberId: string, businessId: string) {
    return this.prisma.businessMember.delete({
      where: { id: memberId, businessId },
    });
  }

  /**
   * Get a user's role in a business
   */
  async getMemberRole(businessId: string, userId: string): Promise<UserRole | null> {
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    return member?.role ?? null;
  }

  /**
   * Create owner membership (called during registration)
   */
  async createOwnerMember(businessId: string, userId: string) {
    return this.prisma.businessMember.create({
      data: {
        businessId,
        userId,
        role: 'owner',
      },
    });
  }
}
