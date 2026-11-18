import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AdminContextService } from './admin-context.service';
import { AdminContext } from './interfaces/admin-context.interface';

/**
 * Interceptor that captures admin context from JWT tokens
 * and stores it in AsyncLocalStorage for the duration of the request
 * Only applies to admin-authenticated requests
 */
@Injectable()
export class AdminContextInterceptor implements NestInterceptor {
  constructor(private readonly adminContextService: AdminContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const ADMIN_PORTAL_TYPES = ['ADMIN', 'CMS', 'SUPPORT', 'MARKETING', 'ACCOUNTING', 'OPERATION', 'OPERATIONS'];

    // Only store context for admin and panel users
    if (user && (ADMIN_PORTAL_TYPES.includes(user.type) || user.adminId)) {
      const adminContext: AdminContext = {
        adminId: user.adminId || user.userId,
        email: user.email || '',
        role: user.role || 'ADMIN',
        permissions: user.permissions || [],
      };

      // Execute the request handler within the admin context
      return this.adminContextService.run(adminContext, () => next.handle());
    }

    // For non-admin requests, proceed without context
    return next.handle();
  }
}
