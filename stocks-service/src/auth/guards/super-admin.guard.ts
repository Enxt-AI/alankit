import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Super Admin Guard
 * Checks if authenticated admin has SUPER_ADMIN role
 * Must be used AFTER JwtAuthGuard and AdminGuard
 * Usage: @UseGuards(JwtAuthGuard, AdminGuard, SuperAdminGuard)
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.type !== 'ADMIN') {
      throw new ForbiddenException('Admin authentication required');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
