import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SessionStrategy } from './strategies/session.strategy';
import { SupportJwtAuthGuard } from './guards/support-jwt-auth.guard';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { TicketJwtAuthGuard } from './guards/ticket-jwt-auth.guard';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    RedisModule,
    PrismaModule,
    ConfigModule,
  ],
  providers: [
    SessionStrategy,
    SupportJwtAuthGuard,
    AdminJwtAuthGuard,
    TicketJwtAuthGuard,
  ],
  exports: [
    PassportModule,
    SessionStrategy,
    SupportJwtAuthGuard,
    AdminJwtAuthGuard,
    TicketJwtAuthGuard,
  ],
})
export class AuthModule {}

