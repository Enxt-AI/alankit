import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STEP_UP_MAX_AGE_KEY } from '../decorators/require-step-up.decorator';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const maxAgeInMinutes = this.reflector.getAllAndOverride<number>(STEP_UP_MAX_AGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!maxAgeInMinutes) {
      return true; // No step-up requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Authentication required for step-up.',
        code: 'STEP_UP_REQUIRED'
      });
    }

    const stepUpVerifiedAt = user.stepUpVerifiedAt;
    
    if (!stepUpVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Sensitive action requires step-up authentication.',
        code: 'STEP_UP_REQUIRED'
      });
    }

    const ageInMilliseconds = Date.now() - stepUpVerifiedAt;
    const maxAgeInMilliseconds = maxAgeInMinutes * 60 * 1000;

    if (ageInMilliseconds > maxAgeInMilliseconds) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Step-up authentication expired. Please verify again.',
        code: 'STEP_UP_REQUIRED'
      });
    }

    return true;
  }
}
