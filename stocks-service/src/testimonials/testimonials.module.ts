import { Module } from '@nestjs/common';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VersioningModule } from '../versioning/versioning.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

/**
 * TestimonialsModule bundles the testimonials feature.
 *
 * Imports:
 *   - PrismaModule   -- database access
 *   - VersioningModule -- version history and rollback support
 *   - AuthModule      -- JWT auth guards (CMS + Admin)
 *   - CommonModule    -- shared services (e.g. AdminContextService)
 */
@Module({
  imports: [PrismaModule, VersioningModule, AuthModule, CommonModule],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
