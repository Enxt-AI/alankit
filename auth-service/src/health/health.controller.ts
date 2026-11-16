import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private redisService: RedisService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check() {
    const redisPing = await this.redisService.ping();
    const redisStatus = redisPing === 'PONG' ? 'up' : 'down';

    return {
      status: redisStatus === 'up' ? 'ok' : 'error',
    };
  }
}
