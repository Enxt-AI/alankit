import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required permissions for a route
 * @param permissions Array of permission strings required to access the route
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

/**
 * Alias decorator for compatibility with alternative naming.
 * Matches the plan wording (`@Permissions(...)`) while using the same metadata key.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

/**
 * Guard that checks if the authenticated admin has the required permissions
 * Provides fine-grained access control beyond role-based checks
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Must be authenticated
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Must be admin / panel type
    const ADMIN_PORTAL_TYPES = ['ADMIN', 'CMS', 'SUPPORT', 'MARKETING', 'ACCOUNTING', 'OPERATION', 'OPERATIONS'];
    if (!ADMIN_PORTAL_TYPES.includes(user.type)) {
      throw new ForbiddenException('Admin access required');
    }

    // Get required permissions from metadata (method-level takes precedence over class-level)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Super admin has all permissions
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Check if user has at least one of the required permissions
    const userPermissions = user.permissions || [];

    // Permission mapping for backward compatibility
    // Legacy permissions map to new granular permissions
    const effectivePermissions = [...userPermissions];

    // Legacy CMS mappings exclude carousel: it requires explicit assignment.
    if (userPermissions.includes('manage_content')) {
      effectivePermissions.push(
        'cms_static_pages',
        'cms_articles',
        'cms_news',
        'cms_faqs',
        'cms_stocks',
        'cms_baskets',
        'cms_testimonials',
        'cms_demat_approval',
      );
    }

    // If user is a CONTENT_MANAGER with unconfigured permissions, grant default CMS permissions
    if (user.role === 'CONTENT_MANAGER' && userPermissions.length === 0) {
      effectivePermissions.push(
        'cms_static_pages',
        'cms_articles',
        'cms_news',
        'cms_faqs',
        'cms_stocks',
        'cms_baskets',
        'cms_testimonials',
        'cms_demat_approval',
      );
    }

    // Demat approval alias mapping (interchangeable for backward compatibility)
    if (effectivePermissions.includes('cms_demat_approval') && !effectivePermissions.includes('demat_approval')) {
      effectivePermissions.push('demat_approval');
    }
    if (effectivePermissions.includes('demat_approval') && !effectivePermissions.includes('cms_demat_approval')) {
      effectivePermissions.push('cms_demat_approval');
    }

    const hasPermission = requiredPermissions.some((permission) =>
      effectivePermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
