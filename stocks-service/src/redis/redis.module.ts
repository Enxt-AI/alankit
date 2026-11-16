import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global module that provides Redis access for caching
 * @Global decorator makes RedisService available without importing RedisModule everywhere
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
