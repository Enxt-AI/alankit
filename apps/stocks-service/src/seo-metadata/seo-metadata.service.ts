import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSeoMetadataDto } from './dto/seo-metadata.dto';
import { triggerFrontendRevalidation } from './revalidation.helper';

@Injectable()
export class SeoMetadataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** Fire-and-forget revalidation of the frontend cache for the given path. */
  private revalidate(path: string): void {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const secret = this.configService.get<string>('REVALIDATION_SECRET', '');
    if (secret) {
      triggerFrontendRevalidation(path, frontendUrl, secret);
    }
  }

  async findAll() {
    return this.prisma.seoMetadata.findMany({
      orderBy: { path: 'asc' },
    });
  }

  async findByPath(path: string) {
    const seo = await this.prisma.seoMetadata.findUnique({
      where: { path },
      select: {
        path: true,
        metaTitle: true,
        metaDescription: true,
        schemaMarkup: true,
        ogTitle: true,
        ogDescription: true,
        ogImage: true,
        twitterCard: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterImage: true,
        pageContent: true,
      },
    });
    if (!seo) {
      throw new NotFoundException(`SEO metadata not found for path ${path}`);
    }
    return seo;
  }

  async upsert(dto: UpsertSeoMetadataDto) {
    let result;
    const { id, ...data } = dto;

    if (id) {
      const existing = await this.prisma.seoMetadata.findUnique({
        where: { id },
      });

      result = await this.prisma.seoMetadata.update({
        where: { id },
        data,
      });

      if (existing && existing.path !== result.path) {
        this.revalidate(existing.path);
      }
    } else {
      result = await this.prisma.seoMetadata.upsert({
        where: { path: data.path },
        update: data,
        create: data,
      });
    }

    this.revalidate(result.path);
    return result;
  }

  async remove(id: string) {
    const seo = await this.prisma.seoMetadata.findUnique({
      where: { id },
    });

    if (!seo) {
      throw new NotFoundException(`SEO metadata with ID '${id}' not found`);
    }

    const result = await this.prisma.seoMetadata.delete({
      where: { id },
    });

    this.revalidate(seo.path);
    return result;
  }
}
