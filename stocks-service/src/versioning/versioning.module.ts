import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { VersioningService } from './versioning.service';

/**
 * Module for content versioning functionality
 * Provides versioning services for all CMS entities
 */
@Module({
  imports: [PrismaModule, CommonModule],
  providers: [VersioningService],
  exports: [VersioningService],
})
export class VersioningModule {}
