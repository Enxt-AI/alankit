import { Module } from '@nestjs/common';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

/**
 * CarouselModule
 * Handles carousel media management (images, videos, GIFs) for the Android app.
 */
@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [CarouselController],
  providers: [CarouselService],
  exports: [CarouselService],
})
export class CarouselModule {}
