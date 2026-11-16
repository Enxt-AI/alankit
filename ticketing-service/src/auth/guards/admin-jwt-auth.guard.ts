import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Admin Authentication Guard for ticketing service
 * Protects Admin panel routes that require admin authentication
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    if (user.type !== 'ADMIN') {
      throw new UnauthorizedException('Insufficient permissions: Admin access required');
    }
    return user;
  }
}

