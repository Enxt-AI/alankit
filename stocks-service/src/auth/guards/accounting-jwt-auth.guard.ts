import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AccountingJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    const isAllowedType = user.type === 'ADMIN' || user.type === 'ACCOUNTING';
    const isAllowedRole = ['ACCOUNTANT', 'SUPER_ADMIN', 'ADMIN'].includes(user.role);
    if (!isAllowedType && !isAllowedRole) {
      throw new UnauthorizedException('Insufficient permissions');
    }
    return user;
  }
}
