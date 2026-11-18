import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { VersioningModule } from '../versioning/versioning.module';
import { StaticPagesController } from './static-pages.controller';
import { StaticPagesService } from './static-pages.service';

/**
 * Module for static pages management
 * Provides CMS functionality for About Us, Contact, Terms & Conditions pages
 */
@Module({
  imports: [PrismaModule, AuthModule, VersioningModule],
  controllers: [StaticPagesController],
  providers: [StaticPagesService],
  exports: [StaticPagesService],
})
export class StaticPagesModule {}
