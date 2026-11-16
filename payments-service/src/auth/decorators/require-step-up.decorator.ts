import { SetMetadata } from '@nestjs/common';

export const STEP_UP_MAX_AGE_KEY = 'stepUpMaxAge';
/**
 * Require Step-Up Authentication for this route.
 * @param maxAgeInMinutes The maximum age of the step-up verification in minutes.
 */
export const RequireStepUp = (maxAgeInMinutes: number = 15) => SetMetadata(STEP_UP_MAX_AGE_KEY, maxAgeInMinutes);
