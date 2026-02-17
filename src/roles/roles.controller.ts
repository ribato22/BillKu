import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /team — List team members
   */
  @Get()
  async listMembers(@CurrentUser() user: CurrentUserData) {
    const members = await this.rolesService.listMembers(user.businessId);
    return { data: members };
  }

  /**
   * POST /team/invite — Invite a member
   */
  @Post('invite')
  async inviteMember(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { email: string; role?: UserRole },
  ) {
    // Only owners can invite
    const callerRole = await this.rolesService.getMemberRole(
      user.businessId,
      user.userId,
    );
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new ForbiddenException('Hanya owner/admin yang bisa mengundang anggota');
    }

    if (!body.email) {
      throw new BadRequestException('Email wajib diisi');
    }

    // Cannot invite as owner
    const role = body.role || 'staff';
    if (role === 'owner') {
      throw new BadRequestException('Tidak bisa mengundang sebagai owner');
    }

    try {
      const member = await this.rolesService.inviteMember(
        user.businessId,
        body.email,
        role,
        user.userId,
      );
      await this.auditService.log({
        businessId: user.businessId,
        userId: user.userId,
        action: 'invite',
        resource: 'team-member',
        resourceId: member.id,
        changes: { email: body.email, role },
      });
      return { data: member };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('User sudah menjadi anggota tim');
      }
      throw error;
    }
  }

  /**
   * PATCH /team/:memberId/role — Update member role
   */
  @Patch(':memberId/role')
  async updateRole(
    @CurrentUser() user: CurrentUserData,
    @Param('memberId') memberId: string,
    @Body() body: { role: UserRole },
  ) {
    const callerRole = await this.rolesService.getMemberRole(
      user.businessId,
      user.userId,
    );
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Hanya owner yang bisa mengubah role');
    }

    if (!body.role || !['admin', 'staff'].includes(body.role)) {
      throw new BadRequestException('Role harus admin atau staff');
    }

    const member = await this.rolesService.updateMemberRole(
      memberId,
      user.businessId,
      body.role,
    );
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'update-role',
      resource: 'team-member',
      resourceId: memberId,
      changes: { newRole: body.role },
    });
    return { data: member };
  }

  /**
   * DELETE /team/:memberId — Remove member
   */
  @Delete(':memberId')
  async removeMember(
    @CurrentUser() user: CurrentUserData,
    @Param('memberId') memberId: string,
  ) {
    const callerRole = await this.rolesService.getMemberRole(
      user.businessId,
      user.userId,
    );
    if (callerRole !== 'owner') {
      throw new ForbiddenException('Hanya owner yang bisa menghapus anggota');
    }

    await this.rolesService.removeMember(memberId, user.businessId);
    await this.auditService.log({
      businessId: user.businessId,
      userId: user.userId,
      action: 'remove',
      resource: 'team-member',
      resourceId: memberId,
    });
    return { data: { message: 'Anggota berhasil dihapus' } };
  }
}
