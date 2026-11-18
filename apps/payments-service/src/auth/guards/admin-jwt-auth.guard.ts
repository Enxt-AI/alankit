import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Admin JWT Authentication Guard
 * Protects admin panel routes that require authentication
 * Uses admin_panel_token cookie for JWT extraction
 * Usage: @UseGuards(AdminJwtAuthGuard)
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
