import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { VersioningModule } from '../versioning/versioning.module';
import { CommonModule } from '../common/common.module';

/**
 * Content Module
 * Handles news and blog management
 */
@Module({
  imports: [PrismaModule, AuthModule, VersioningModule, CommonModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
