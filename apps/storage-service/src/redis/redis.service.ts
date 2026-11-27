import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PinoNestLogger } from '@/logger';

const service = 'storage-service';
const ctx = 'RedisService';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new PinoNestLogger(service, ctx);
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is required');
    }
    this.client = new Redis(redisUrl);

    this.client.on('error', (err) => {
      this.logger.warn({ err }, `Redis connection error: ${err?.message || err}`);
    });
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300) {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async get(key: string): Promise<any> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string) {
    await this.client.del(key);
  }
}