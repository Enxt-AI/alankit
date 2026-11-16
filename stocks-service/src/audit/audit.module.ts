import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * Module for audit log functionality
 * Provides audit log retrieval and creation services
 */
@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
