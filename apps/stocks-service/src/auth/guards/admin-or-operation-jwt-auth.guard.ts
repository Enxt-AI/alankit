import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminOrOperationJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    if (user.type !== 'ADMIN' && user.type !== 'OPERATION' && user.type !== 'ACCOUNTING') {
      throw new UnauthorizedException('Insufficient permissions');
    }
    return user;
  }
}
