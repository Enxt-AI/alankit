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

    if (user.type !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
