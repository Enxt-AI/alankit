import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { setKey, getKey, delKey, redis } from 'redis-service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  async onModuleDestroy() {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300) {
    await setKey(key, value, ttlSeconds);
  }

  async get(key: string): Promise<any> {
    return await getKey(key);
  }

  async delete(key: string) {
    await delKey(key);
  }
}
