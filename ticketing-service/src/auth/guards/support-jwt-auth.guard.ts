import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Support Authentication Guard for ticketing service
 * Protects Support panel routes that require support or admin authentication
 */
@Injectable()
export class SupportJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    if (user.type !== 'ADMIN' && user.type !== 'SUPPORT') {
      throw new UnauthorizedException('Insufficient permissions: Support or Admin access required');
    }
    return user;
  }
}

