import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Admin Guard
 * Checks if authenticated user is an admin
 * Must be used AFTER JwtAuthGuard
 * Usage: @UseGuards(JwtAuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Allow any staff member (Admin, Accounting, Operations, etc.)
    const isStaff =
      user.type === 'ADMIN' ||
      user.type === 'ACCOUNTING' ||
      user.type === 'OPERATION' ||
      user.type === 'CMS' ||
      user.type === 'SUPPORT' ||
      user.role === 'ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      !!user.adminId;

    if (!isStaff) {
      throw new ForbiddenException('Staff access required');
    }

    return true;
  }
}
