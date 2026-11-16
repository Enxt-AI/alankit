import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'db-unlisted-stox';
import { PinoNestLogger } from '@smc/logger';

const service = 'auth-service';
const ctx = 'PrismaService';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger(service, ctx);

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'local' ||
      !process.env.NODE_ENV;

    super(
      dbUrl
        ? {
            datasources: { db: { url: dbUrl } },
            log: isDev ? ['warn', 'error'] : ['error'],
          }
        : {
            log: isDev ? ['warn', 'error'] : ['error'],
          },
    );

    this.logger.log(
      dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : '[DATABASE_URL missing]',
    );
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log({ event: 'prisma.connected' }, 'Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log({ event: 'prisma.disconnected' }, 'Prisma disconnected from database');
  }
}