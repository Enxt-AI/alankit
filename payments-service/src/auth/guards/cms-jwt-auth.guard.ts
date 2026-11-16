import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * CMS JWT Authentication Guard
 * Protects CMS panel routes that require authentication
 * Uses cms_panel_token cookie for JWT extraction
 * Usage: @UseGuards(CmsJwtAuthGuard)
 */
@Injectable()
export class CmsJwtAuthGuard extends AuthGuard('cms-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
