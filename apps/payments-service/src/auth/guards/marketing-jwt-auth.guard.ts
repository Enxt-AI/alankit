import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Marketing JWT Authentication Guard
 * Protects Marketing panel routes that require authentication
 * Uses marketing_panel_token cookie for JWT extraction
 * Usage: @UseGuards(MarketingJwtAuthGuard)
 */
@Injectable()
export class MarketingJwtAuthGuard extends AuthGuard('marketing-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
