import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * CmsGuard
 *
 * Lightweight guard for CMS-authenticated routes.
 * The CMS JWT strategy already validates token type and allowed roles.
 * This guard provides an explicit additional check to align with route usage patterns.
 */
@Injectable()
export class CmsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.type !== 'ADMIN') {
      throw new ForbiddenException('CMS access required');
    }

    if (!['CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new ForbiddenException('CMS access required');
    }

    return true;
  }
}
