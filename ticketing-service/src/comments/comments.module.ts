import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  // Import the PrismaModule to access the PrismaService.
  imports: [PrismaModule, NotificationModule],

  // Register the CommentsController and CommentsService.
  controllers: [CommentsController],

  // Provide the CommentsService for dependency injection.
  providers: [CommentsService],
})
export class CommentsModule {}
