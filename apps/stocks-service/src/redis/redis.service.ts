import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { setKey, getKey, delKey, redis } from 'redis-service';

/**
 * RedisService wraps the redis-service package for caching
 * Provides methods to store, retrieve, and delete cached data
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  async onModuleDestroy() {
    try {
      await redis.quit();
    } catch {
      // If Redis isn't connected or quit fails, ensure the socket is torn down.
      redis.disconnect();
    }
  }
  /**
   * Set a value in Redis with expiry time
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
   */
  async set(key: string, value: any, ttlSeconds: number = 300) {
    await setKey(key, value, ttlSeconds);
  }

  /**
   * Get a value from Redis
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  async get(key: string): Promise<any> {
    return await getKey(key);
  }

  /**
   * Delete a value from Redis
   * @param key - Cache key
   */
  async delete(key: string) {
    await delKey(key);
  }
}
