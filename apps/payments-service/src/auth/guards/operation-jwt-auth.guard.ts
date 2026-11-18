import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Operation JWT Authentication Guard
 * Protects Operation panel routes that require authentication
 * Uses operation_panel_token cookie for JWT extraction
 * Usage: @UseGuards(OperationJwtAuthGuard)
 */
@Injectable()
export class OperationJwtAuthGuard extends AuthGuard('operation-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
