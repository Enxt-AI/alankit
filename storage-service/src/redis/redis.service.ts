import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PinoNestLogger } from '@smc/logger';

const service = 'storage-service';
const ctx = 'RedisService';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new PinoNestLogger(service, ctx);
  private client: Redis;

  constructor() {
    const REDIS_TLS = (process.env.REDIS_TLS || '').toLowerCase() === 'true';
    this.client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          ...(REDIS_TLS ? { tls: {} } : {}),
        });

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