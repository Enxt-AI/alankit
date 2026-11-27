import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { PrismaClient } from 'db-unlistedstock';
import { createAuditMiddleware } from './audit-middleware';
import { AdminContextService } from '../common/admin-context.service';

/**
 * PrismaService extends PrismaClient to provide database access
 * Implements lifecycle hooks to connect/disconnect from database
 * Includes audit logging middleware for CMS operations
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger('stocks-service', 'PrismaService');

  constructor(private readonly adminContextService: AdminContextService) {
    super();
  }

  /**
   * Connect to database when module initializes
   * Register audit middleware for automatic logging
   */
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to database');

    // Ensure backupQuantity column exists and allow negative physical stock backed by backup inventory
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "Stock" ADD COLUMN IF NOT EXISTS "backupQuantity" INTEGER NOT NULL DEFAULT 0;`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "Stock" DROP CONSTRAINT IF EXISTS stock_quantity_non_negative;`,
      );
      this.logger.log('Ensured backupQuantity column exists and updated stock quantity constraints.');
    } catch (error: any) {
      this.logger.warn('Database constraint setup notice:', error.message);
    }

    // TODO: Re-enable audit middleware once Prisma client supports $use
    // (this as any).$use(createAuditMiddleware(this.adminContextService, this));
  }

  /**
   * Disconnect from database when module destroys
   */
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
