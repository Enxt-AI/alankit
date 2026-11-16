import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * AdminGuard checks if the authenticated user is an admin
 * Use this guard on admin-only endpoints
 * Must be used AFTER JwtAuthGuard
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    // Check if user exists
    // Check if token type is ADMIN
    if (user.type !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
