import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionStrategy } from './strategies/session.strategy';
import { AdminGuard } from './guards/admin.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { ThrottlerBehindProxyGuard } from './guards/throttler-behind-proxy.guard';
// NOTE: RMJwtAuthGuard import removed as part of RM system deprecation.
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from 'email-service';

/**
 * AuthModule bundles all authentication-related components
 * - Registers JWT module with secret and expiry
 * - Registers Passport for strategy-based authentication
 * - Provides AuthService and JwtStrategy
 * - Imports SmsModule for OTP SMS delivery via SMC SMS Gateway
 */
@Module({
  imports: [
    // Register Passport module
    PassportModule,

    // Import SmsModule for SMS gateway access (OTP delivery)
    SmsModule,

    // Import EmailModule for email notifications
    EmailModule,

    // Register Throttler module for rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get('THROTTLE_TTL', 60000), // 60 seconds default
          limit: configService.get('THROTTLE_LIMIT', 1000), // 1000 requests default
        },
      ],
    }),

  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionStrategy,
    AdminGuard,
    SuperAdminGuard,
    // NOTE: RMJwtAuthGuard removed from providers as part of RM system deprecation.
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
  exports: [
    AuthService,
    SessionStrategy,
    AdminGuard,
    SuperAdminGuard,
    // NOTE: RMJwtAuthGuard removed from exports as part of RM system deprecation.
  ],
})
export class AuthModule {}
