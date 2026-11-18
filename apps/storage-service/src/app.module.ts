import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MinioService } from './minio.service';
import { UploadController } from './upload.controller';
import { StorageController } from './storage.controller';
import { AuthModule } from './auth/auth.module';
import { GlobalJwtAuthGuard } from './auth/guards/global-jwt-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
  controllers: [AppController, UploadController, StorageController],
  providers: [
    AppService,
    MinioService,
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthGuard,
    },
  ],
})
export class AppModule {}
