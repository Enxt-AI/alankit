import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { BullModule } from '@nestjs/bull';
import { EmailModule } from 'email-service';
import { ConfigService } from '@nestjs/config';
import { GlobalJwtAuthGuard } from './auth/guards/global-jwt-auth.guard';
import { getBullRedisOptions } from './redis/bull-redis-options';

/**
 * AppModule is the root module of the application
 * Imports all feature modules and global configuration
 */
@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
      envFilePath: join(__dirname, '..', '.env'),
    }),

    // Global modules (marked with @Global decorator)
    PrismaModule, // Database access
    RedisModule, // Redis/OTP storage

    // Feature modules
    AuthModule, // Authentication endpoints
    HealthModule, // Health check endpoints
    
    // Infrastructure modules
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: getBullRedisOptions(config.getOrThrow('REDIS_URL')),
      }),
    }),
    EmailModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthGuard,
    },
  ],
})
export class AppModule {}
