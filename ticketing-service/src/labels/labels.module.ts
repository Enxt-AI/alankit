import { Module } from '@nestjs/common';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Labels module
 * Handles all label-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [LabelsController],
  providers: [LabelsService],
})
export class LabelsModule {}
