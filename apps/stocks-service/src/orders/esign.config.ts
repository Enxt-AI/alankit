import { ConfigService } from '@nestjs/config';

export function positiveInteger(config: ConfigService, key: string, fallback: number, max = 86400000): number {
  const value = Number(config.get(key) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${key} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function esignRedisOptions(config: ConfigService) {
  return config.getOrThrow<string>('REDIS_URL');
}
