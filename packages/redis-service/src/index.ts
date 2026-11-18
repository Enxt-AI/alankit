import Redis from 'ioredis';

const REDIS_TLS = (process.env.REDIS_TLS || '').toLowerCase() === 'true';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      ...(REDIS_TLS ? { tls: {} } : {}),
    });

// Prevent noisy "Unhandled error event" logs from ioredis.
redis.on('error', (err) => {
  // Keep this lightweight and non-fatal; callers can decide how to handle outages.
  console.warn('[redis-service] Redis error:', err?.message || err);
});

export async function setKey(key: string, value: any, ttlSeconds: number) {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function getKey(key: string) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function delKey(key: string) {
  await redis.del(key);
}

export { redis };

/** Account-wide admission control. Redis TIME avoids replica clock skew. */
export async function acquireProviderSlot(account: string, limit: number): Promise<boolean> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid provider rate limit');
  const admitted = await redis.eval(`
    local now = redis.call('TIME')
    local key = KEYS[1] .. ':' .. now[1]
    local count = redis.call('INCR', key)
    if count == 1 then redis.call('EXPIRE', key, 2) end
    return count <= tonumber(ARGV[1]) and 1 or 0
  `, 1, 'provider-rate:' + account, limit);
  return Number(admitted) === 1;
}
