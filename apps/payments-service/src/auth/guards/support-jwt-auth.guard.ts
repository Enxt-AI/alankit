import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Support JWT Authentication Guard
 * Protects Support panel routes that require authentication
 * Uses support_panel_token cookie for JWT extraction
 * Usage: @UseGuards(SupportJwtAuthGuard)
 */
@Injectable()
export class SupportJwtAuthGuard extends AuthGuard('support-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
