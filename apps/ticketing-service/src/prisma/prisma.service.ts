import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { PrismaClient } from 'db-ticketing';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger('ticketing-service', 'PrismaService');

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    // When module initializes, connect to the database.
    await this.$connect();
    this.logger.log('Prisma connected to the database.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from the database.');
  }
}
