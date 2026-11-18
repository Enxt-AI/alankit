import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Accounting JWT Authentication Guard
 * Protects Accounting panel routes that require authentication
 * Uses accounting_panel_token cookie for JWT extraction
 * Usage: @UseGuards(AccountingJwtAuthGuard)
 */
@Injectable()
export class AccountingJwtAuthGuard extends AuthGuard('accounting-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
