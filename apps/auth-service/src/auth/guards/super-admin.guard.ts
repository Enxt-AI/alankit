import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PinoNestLogger } from '@/logger';

const logger = new PinoNestLogger('auth-service', 'SuperAdminGuard');

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    logger.debug(
      {
        userExists: !!user,
        userType: user?.type,
        userRole: user?.role,
        userPermissions: user?.permissions,
        hasCreateAdmins: user?.permissions?.includes('create_admins'),
      },
      'SuperAdminGuard - Checking access',
    );

    if (!user || user.type !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    const hasPermission =
      user.permissions?.includes('create_admins') ||
      user.permissions?.includes('*');

    if (!hasPermission) {
      throw new ForbiddenException('create_admins permission required');
    }

    return true;
  }
}
