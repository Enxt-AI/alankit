import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SessionStrategy } from './strategies/session.strategy';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    RedisModule,
    ConfigModule,
  ],
  providers: [SessionStrategy],
  exports: [PassportModule, SessionStrategy],
})
export class AuthModule {}
