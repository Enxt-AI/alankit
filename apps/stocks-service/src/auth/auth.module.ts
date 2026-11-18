import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { SessionStrategy } from './strategies/session.strategy';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { CmsJwtAuthGuard } from './guards/cms-jwt-auth.guard';
import { SupportJwtAuthGuard } from './guards/support-jwt-auth.guard';
import { MarketingJwtAuthGuard } from './guards/marketing-jwt-auth.guard';
import { AccountingJwtAuthGuard } from './guards/accounting-jwt-auth.guard';
import { OperationJwtAuthGuard } from './guards/operation-jwt-auth.guard';
import { AdminOrOperationJwtAuthGuard } from './guards/admin-or-operation-jwt-auth.guard';
import { UserJwtAuthGuard } from './guards/user-jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { EmailModule } from 'email-service';

/**
 * Auth Module
 * Provides session authentication for stocks-service
 * Validates opaque session IDs issued by auth-service
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    RedisModule,
    EmailModule,
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    SessionStrategy,
    UserJwtAuthGuard,
    AdminJwtAuthGuard,
    CmsJwtAuthGuard,
    SupportJwtAuthGuard,
    MarketingJwtAuthGuard,
    AccountingJwtAuthGuard,
    OperationJwtAuthGuard,
    AdminOrOperationJwtAuthGuard,
    AuthService,
  ],
  exports: [
    PassportModule,
    UserJwtAuthGuard,
    AdminJwtAuthGuard,
    CmsJwtAuthGuard,
    SupportJwtAuthGuard,
    MarketingJwtAuthGuard,
    AccountingJwtAuthGuard,
    OperationJwtAuthGuard,
    AdminOrOperationJwtAuthGuard,
    AuthService,
  ],
})
export class AuthModule {}
