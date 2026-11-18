import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * User JWT Authentication Guard
 * Protects user-only routes (rejects admin/cms/support tokens).
 * Usage: @UseGuards(UserJwtAuthGuard)
 */
@Injectable()
export class UserJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const canActivate = (await super.canActivate(context)) as boolean;
    if (!canActivate) {
      return false;
    }

    const req = context.switchToHttp().getRequest();
    if (!req?.user || req.user.type !== 'USER' || !req.user.userId) {
      throw new UnauthorizedException('User authentication required');
    }

    return true;
  }
}
