import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses the global JWT auth guard.
 * Use sparingly: only for health checks, login, OTP, and truly public endpoints.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
