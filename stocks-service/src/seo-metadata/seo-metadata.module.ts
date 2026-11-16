import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeoMetadataService } from './seo-metadata.service';
import { SeoMetadataController } from './seo-metadata.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SeoMetadataController],
  providers: [SeoMetadataService],
  exports: [SeoMetadataService],
})
export class SeoMetadataModule {}
