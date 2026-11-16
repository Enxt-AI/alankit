import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { PrismaClient } from 'db-unlisted-stox';

@Injectable()
export class AdminPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger('ticketing-service', 'AdminPrismaService');

  /**
   * Connects to unlisted_stox_db (separate from ticketing_system)
   * for Admin/User/Stock models used in ticket assignment.
   * Uses ADMIN_DATABASE_URL (fallback: DATABASE_URL).
   */
  constructor() {
    const dbUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'local';
    const logConfig: ('query' | 'info' | 'warn' | 'error')[] = isDev
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'];

    super({
      datasources: {
        db: { url: dbUrl },
      },
      log: logConfig,
    });

    if (!process.env.ADMIN_DATABASE_URL && process.env.DATABASE_URL) {
      this.logger.warn(
        '⚠️ ADMIN_DATABASE_URL not set, falling back to DATABASE_URL. This may point to ticketing_system DB instead of unlisted_stox_db.',
      );
    }
    this.logger.log('AdminPrisma DB:', dbUrl?.replace(/:[^:@]+@/, ':****@'));
  }

  async onModuleInit() {
    // When module initializes, connect to the database.
    await this.$connect();
    this.logger.log('AdminPrisma connected to the database.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('AdminPrisma disconnected from the database.');
  }

  /**
   * Get user details by ID from db-unlisted-stox database
   * Used for notification purposes
   * @param userId - User ID to fetch
   * @returns User object or null if not found
   */
  async getUserById(userId: string) {
    return await this.user.findUnique({
      where: { id: userId },
    });
  }
}
