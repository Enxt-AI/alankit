import type { RedisOptions } from 'ioredis';

export function getBullRedisOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const isTls = url.protocol === 'rediss:';
  if (!isTls && url.protocol !== 'redis:') {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }

  const database = url.pathname.replace(/^\/+/, '');
  if (database && !/^\d+$/.test(database)) {
    throw new Error('REDIS_URL database path must be a non-negative integer');
  }

  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
    ...(isTls ? { tls: {} } : {}),
    maxRetriesPerRequest: 1,
  };
}
