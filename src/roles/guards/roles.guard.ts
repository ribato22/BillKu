import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesService } from '../roles.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.businessId || !user?.userId) {
      throw new ForbiddenException('Akses ditolak');
    }

    const userRole = await this.rolesService.getMemberRole(
      user.businessId,
      user.userId,
    );

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Membutuhkan role: ${requiredRoles.join(' atau ')}`,
      );
    }

    return true;
  }
}
