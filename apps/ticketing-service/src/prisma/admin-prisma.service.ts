import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { PrismaClient } from 'db-unlistedstock';
import type { User } from 'db-unlistedstock';

@Injectable()
export class AdminPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger('ticketing-service', 'AdminPrismaService');

  /**
   * Connects to stocks (separate from ticketing_system)
   * for Admin/User/Stock models used in ticket assignment.
   * Uses the shared DATABASE_URL.
   */
  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl?.trim()) {
      throw new Error('DATABASE_URL is required for AdminPrismaService.');
    }

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

    this.logger.log('AdminPrisma DB:', dbUrl.replace(/:[^:@]+@/, ':****@'));
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
   * Get user details by ID from the stocks database
   * Used for notification purposes
   * @param userId - User ID to fetch
   * @returns User object or null if not found
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.user.findUnique({
      where: { id: userId },
    });
  }
}
