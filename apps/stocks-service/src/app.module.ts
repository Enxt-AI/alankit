import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { esignRedisOptions } from './orders/esign.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { GlobalJwtAuthGuard } from './auth/guards/global-jwt-auth.guard';
import { StocksModule } from './stocks/stocks.module';
import { UpcomingStocksModule } from './upcoming-stocks/upcoming-stocks.module';
import { OrdersModule } from './orders/orders.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ContentModule } from './content/content.module';
// NOTE: ReferralsModule, RMReferralsModule, RMPayoutsModule, and RMModule were
// removed as part of the RM and referral system deprecation.
import { StatsModule } from './stats/stats.module';
import { MarketingModule } from './marketing/marketing.module';
import { FaqsModule } from './faqs/faqs.module';
import { VersioningModule } from './versioning/versioning.module';
import { StaticPagesModule } from './static-pages/static-pages.module';
import { CommonModule } from './common/common.module';
import { AdminContextInterceptor } from './common/admin-context.interceptor';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { KycModule } from './kyc/kyc.module';
import { EmailModule } from 'email-service';
import { HealthModule } from './health/health.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { NotificationsModule } from './notifications/notifications.module';

import { TestimonialsModule } from './testimonials/testimonials.module';
import { AccountingModule } from './accounting/accounting.module';
import { BatchModule } from './batch/batch.module';
import { CouponsModule } from './coupons/coupons.module';
import { SeoMetadataModule } from './seo-metadata/seo-metadata.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { CarouselModule } from './carousel/carousel.module';
/**
 * AppModule is the root module of the stocks-service application.
 * Imports all feature modules and global configuration.
 * Registers global interceptor for admin context management.
 */
@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: esignRedisOptions(configService),
      }),
      inject: [ConfigService],
    }),

    // Global modules
    PrismaModule, // Database access
    RedisModule, // Redis caching
    AuthModule, // JWT authentication
    CommonModule, // Shared services (AdminContextService)
    EmailModule, // Email notifications

    // Feature modules
    StocksModule, // Stock management
    UpcomingStocksModule, // Upcoming stocks management
    OrdersModule, // Order management
    PortfolioModule, // Portfolio management
    KycModule, // KYC verification (placeholder for Phase 2)
    ContentModule, // News & Blogs management
    FaqsModule, // FAQs management
    VersioningModule, // Content versioning
    StaticPagesModule, // Static pages CMS
    AuditModule, // Audit logging
    MarketingModule, // Marketing campaigns and leads
    StatsModule, // Admin statistics
    HealthModule, // Health check endpoints
    WatchlistModule, // User watchlist endpoints
    NotificationsModule, // In-app user notifications
    SettingsModule, // Global Admin Settings

    TestimonialsModule, // Client testimonials management (CMS + Admin + Public)
    AccountingModule, // Accounting: Ledgers, Vouchers, double-entry bookkeeping
    BatchModule, // NSDL Batch processing
    CouponsModule, // RM Generated Coupons
    SeoMetadataModule, // Global SEO metadata management
    ApprovalsModule, // Maker-Checker Approvals
    CarouselModule, // App carousel media management (CMS + Admin + Public)
    // Global scheduler (cron jobs). IMPORTANT: Register once to avoid duplicate job execution.
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT guard — every route requires auth unless @Public()
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthGuard,
    },
    // Global interceptor for admin context
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminContextInterceptor,
    },
  ],
})
export class AppModule {}
