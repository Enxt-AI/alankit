import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { SeoMetadataService } from './seo-metadata.service';
import { UpsertSeoMetadataDto } from './dto/seo-metadata.dto';
import { RequirePermissions } from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('seo-metadata')
export class SeoMetadataController {
  constructor(private readonly seoMetadataService: SeoMetadataService) {}

  @Public()
  @Get('public')
  findByPathPublic(@Query('path') path: string) {
    return this.seoMetadataService.findByPath(path);
  }

  @RequirePermissions('cms_static_pages')
  @Get('cms/all')
  findAll() {
    return this.seoMetadataService.findAll();
  }

  @RequirePermissions('cms_static_pages')
  @Get('cms')
  findByPath(@Query('path') path: string) {
    return this.seoMetadataService.findByPath(path);
  }

  @RequirePermissions('cms_static_pages')
  @Post('cms')
  upsert(@Body() dto: UpsertSeoMetadataDto) {
    return this.seoMetadataService.upsert(dto);
  }

  @RequirePermissions('cms_static_pages')
  @Delete('cms/:id')
  remove(@Param('id') id: string) {
    return this.seoMetadataService.remove(id);
  }
}
