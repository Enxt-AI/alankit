import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'db-unlistedstock';
import { PinoNestLogger } from '@repo/logger';

const service = 'payments-service';
const ctx = 'PrismaService';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new PinoNestLogger(service, ctx);

  constructor() {
    super();
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