import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from 'db-unlistedstock';
import { PrismaService } from '../prisma/prisma.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PinoNestLogger } from '@repo/logger';

/**
 * Content Service
 * Handles news and article management
 */
@Injectable()
export class ContentService {
  private readonly logger = new PinoNestLogger('stocks-service', 'ContentService');

  constructor(
    private prisma: PrismaService,
    private versioningService: VersioningService,
  ) {}

  /**
   * Helper to sanitize stockId and ensure foreign key integrity
   */
  private async sanitizeStockId(
    stockId?: string | null,
  ): Promise<string | null | undefined> {
    if (stockId === undefined) return undefined;
    if (!stockId || stockId === '_none' || stockId.trim() === '') {
      return null;
    }
    const stockExists = await this.prisma.stock.findUnique({
      where: { id: stockId },
      select: { id: true },
    });
    return stockExists ? stockId : null;
  }

  /**
   * Derive a URL slug from an article title. Only used when the editor leaves
   * the slug field empty, so URLs stay readable without extra typing.
   * Accents are stripped; everything else collapses to single hyphens.
   */
  private slugifyTitle(title: string): string {
    const slug = title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
      .replace(/-+$/g, '');

    // Titles with no latin characters would otherwise produce an empty slug.
    return slug || `article-${Date.now().toString(36)}`;
  }

  // NEWS METHODS
  /**
   * Create news article (Admin only)
   */
  async createNews(dto: CreateNewsDto) {
    try {
      const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
      const news = await this.prisma.news.create({
        data: {
          title: dto.title,
          content: dto.content,
          imageUrl: dto.imageUrl,
          category: dto.category,
          isActive: dto.isActive ?? true,
          stockId: sanitizedStockId ?? null,
        },
      });

      // Create version history (non-blocking)
      try {
        await this.versioningService.createVersion(
          'NEWS',
          news.id,
          news,
          'CREATE',
        );
      } catch (versionError) {
        this.logger.error(
          `[Content Service] Failed to create version for news ${news.id}:`,
          versionError,
        );
        // Don't fail the creation if versioning fails
      }

      return news;
    } catch (error: any) {
      this.logger.error(`[Content Service] Error creating news:`, error);

      // Handle specific Prisma errors
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new BadRequestException('Invalid news article payload or constraint violation.');
      }

      // Generic error
      throw new BadRequestException(
        'Failed to create news article. Please try again.',
      );
    }
  }

  /**
   * Get all news articles (Admin only - includes inactive)
   */
  async getAllNewsAdmin() {
    return await this.prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all active news articles (Public endpoint)
   * Supports filtering by category and date range
   */
  async getAllActiveNews(filters?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    stockId?: string;
  }) {
    const where: Prisma.NewsWhereInput = { isActive: true };

    if (filters?.stockId) {
      where.stockId = filters.stockId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return await this.prisma.news.findMany({
      where,
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        category: true,
        stockId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Get single news article by ID (Public endpoint)
   */
  async getNewsById(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        imageUrl: true,
        category: true,
        stockId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!news || !news.isActive) {
      throw new NotFoundException(`News article with ID ${id} not found`);
    }

    const { isActive: _active, ...rest } = news;
    return rest;
  }

  /**
   * Update news article (Admin only)
   */
  async updateNews(id: string, dto: UpdateNewsDto) {
    try {
      // Validate news exists
      const news = await this.prisma.news.findUnique({ where: { id } });
      if (!news) {
        throw new NotFoundException(`News article with ID ${id} not found`);
      }

      const dataToUpdate: any = { ...dto };
      if ('stockId' in dto) {
        dataToUpdate.stockId = await this.sanitizeStockId(dto.stockId);
      }

      // Update news
      const updatedNews = await this.prisma.news.update({
        where: { id },
        data: dataToUpdate,
      });

      // Create version history (non-blocking)
      try {
        await this.versioningService.createVersion(
          'NEWS',
          updatedNews.id,
          updatedNews,
          'UPDATE',
        );
      } catch (versionError) {
        this.logger.error(
          `[Content Service] Failed to create version for news ${id}:`,
          versionError,
        );
        // Don't fail the update if versioning fails
      }

      return updatedNews;
    } catch (error: any) {
      this.logger.error(`[Content Service] Error updating news ${id}:`, error);

      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle Prisma errors specifically
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        throw new BadRequestException('Invalid news article update payload or constraint violation.');
      }

      // Generic error
      throw new BadRequestException(
        'Failed to update news article. Please try again.',
      );
    }
  }

  /**
   * Delete news article (Admin only - hard delete)
   */
  async deleteNews(id: string) {
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News article with ID ${id} not found`);
    }

    await this.prisma.news.delete({
      where: { id },
    });

    return { success: true, message: 'News article deleted successfully' };
  }

  // ARTICLE METHODS
  /**
   * Create article post (Admin only)
   */
  async createArticle(dto: CreateArticleDto) {
    try {
      const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
      const { faqs, keyFacts, contentReviewedAt, ...rest } = dto;
      const article = await this.prisma.article.create({
        data: {
          ...rest,
          isActive: dto.isActive ?? true,
          stockId: sanitizedStockId ?? null,
          slug: dto.slug ?? this.slugifyTitle(dto.title),
          keyFacts: keyFacts as Prisma.InputJsonValue | undefined,
          contentReviewedAt: contentReviewedAt
            ? new Date(contentReviewedAt)
            : undefined,
          faqs: faqs?.length
            ? {
                create: faqs.map((faq, index) => ({
                  question: faq.question,
                  answer: faq.answer,
                  order: faq.order ?? index,
                })),
              }
            : undefined,
        },
        include: { faqs: { orderBy: { order: 'asc' } } },
      });

      // Create version history (non-blocking)
      try {
        await this.versioningService.createVersion(
          'ARTICLE',
          article.id,
          article,
          'CREATE',
        );
      } catch (versionError) {
        this.logger.error(
          `[Content Service] Failed to create version for article ${article.id}:`,
          versionError,
        );
        // Don't fail the creation if versioning fails
      }

      return article;
    } catch (error: any) {
      this.logger.error(`[Content Service] Error creating article:`, error);

      // Handle specific Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An article with this slug already exists. Choose a different slug.',
          );
        }
        throw new BadRequestException(
          'Invalid article payload or constraint violation.',
        );
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException(
          'Invalid article payload or constraint violation.',
        );
      }

      // Generic error
      throw new BadRequestException(
        'Failed to create article post. Please try again.',
      );
    }
  }

  /**
   * Get all article posts (Admin only - includes inactive)
   */
  async getAllArticlesAdmin() {
    return await this.prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all active article posts (Public endpoint)
   * Supports filtering by category and date range
   */
  async getAllActiveArticles(filters?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    stockId?: string;
  }) {
    const where: Prisma.ArticleWhereInput = { isActive: true };

    if (filters?.stockId) {
      where.stockId = filters.stockId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return await this.prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        imageUrl: true,
        category: true,
        stockId: true,
        keyFacts: true,
        authorName: true,
        authorRole: true,
        authorBio: true,
        reviewedBy: true,
        contentReviewedAt: true,
        createdAt: true,
        faqs: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single article post by ID (Public endpoint)
   */
  async getArticleById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        imageUrl: true,
        category: true,
        stockId: true,
        isActive: true,
        keyFacts: true,
        authorName: true,
        authorRole: true,
        authorBio: true,
        reviewedBy: true,
        contentReviewedAt: true,
        createdAt: true,
        faqs: { orderBy: { order: 'asc' } },
      },
    });

    if (!article || !article.isActive) {
      throw new NotFoundException(`Article post with ID ${id} not found`);
    }

    const { isActive: _active, ...rest } = article;
    return rest;
  }

  /**
   * Update article post (Admin only)
   */
  async updateArticle(id: string, dto: UpdateArticleDto) {
    try {
      // Validate article exists
      const article = await this.prisma.article.findUnique({ where: { id } });
      if (!article) {
        throw new NotFoundException(`Article post with ID ${id} not found`);
      }

      const { faqs, contentReviewedAt, stockId, ...rest } = dto;
      const dataToUpdate: Prisma.ArticleUncheckedUpdateInput = { ...rest };

      if ('stockId' in dto) {
        dataToUpdate.stockId = await this.sanitizeStockId(stockId);
      }
      if (contentReviewedAt !== undefined) {
        dataToUpdate.contentReviewedAt = contentReviewedAt
          ? new Date(contentReviewedAt)
          : null;
      }
      if (faqs !== undefined) {
        // Replace the whole Q&A set: simpler than diffing, and article FAQs
        // are small and edited as a block in the CMS.
        dataToUpdate.faqs = {
          deleteMany: {},
          create: faqs.map((faq, index) => ({
            question: faq.question,
            answer: faq.answer,
            order: faq.order ?? index,
          })),
        };
      }

      // Update article
      const updatedArticle = await this.prisma.article.update({
        where: { id },
        data: dataToUpdate,
        include: { faqs: { orderBy: { order: 'asc' } } },
      });

      // Create version history (non-blocking)
      try {
        await this.versioningService.createVersion(
          'ARTICLE',
          updatedArticle.id,
          updatedArticle,
          'UPDATE',
        );
      } catch (versionError) {
        this.logger.error(
          `[Content Service] Failed to create version for article ${id}:`,
          versionError,
        );
        // Don't fail the update if versioning fails
      }

      return updatedArticle;
    } catch (error: any) {
      this.logger.error(`[Content Service] Error updating article ${id}:`, error);

      // Re-throw NotFoundException / ConflictException as-is
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      // Handle Prisma errors specifically
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An article with this slug already exists. Choose a different slug.',
          );
        }
        throw new BadRequestException(
          'Invalid article update payload or constraint violation.',
        );
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException(
          'Invalid article update payload or constraint violation.',
        );
      }

      // Generic error
      throw new BadRequestException(
        'Failed to update article post. Please try again.',
      );
    }
  }

  /**
   * Delete article post (Admin only - hard delete)
   */
  async deleteArticle(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article post with ID ${id} not found`);
    }

    await this.prisma.article.delete({
      where: { id },
    });

    return { success: true, message: 'Article post deleted successfully' };
  }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  private async propose(entityType: 'NEWS' | 'ARTICLE', entityId: string | null, action: 'CREATE' | 'UPDATE' | 'DELETE', data: any, label: string, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType,
        entityId,
        proposedData: { action, data: JSON.parse(JSON.stringify(data ?? {})), label },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async proposeNewsCreate(dto: CreateNewsDto, adminId: string) {
    const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
    const sanitizedDto = { ...dto, stockId: sanitizedStockId ?? null };
    return this.propose('NEWS', null, 'CREATE', sanitizedDto, `Create news: ${(dto as any)?.title ?? 'record'}`, adminId);
  }

  async proposeNewsUpdate(id: string, dto: UpdateNewsDto, adminId: string) {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`News article with ID ${id} not found`);
    const sanitizedDto: any = { ...dto };
    if ('stockId' in dto) {
      sanitizedDto.stockId = await this.sanitizeStockId(dto.stockId);
    }
    return this.propose('NEWS', id, 'UPDATE', sanitizedDto, `Edit news: ${existing.title}`, adminId);
  }

  async proposeNewsDelete(id: string, adminId: string) {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`News article with ID ${id} not found`);
    return this.propose('NEWS', id, 'DELETE', {}, `Delete news: ${existing.title}`, adminId);
  }

  async proposeArticleCreate(dto: CreateArticleDto, adminId: string) {
    const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
    // Derive the slug here too so the pending change shows the final URL and
    // the approved row matches what the editor saw.
    const sanitizedDto = {
      ...dto,
      stockId: sanitizedStockId ?? null,
      slug: dto.slug ?? this.slugifyTitle(dto.title),
    };
    return this.propose('ARTICLE', null, 'CREATE', sanitizedDto, `Create article: ${(dto as any)?.title ?? 'record'}`, adminId);
  }

  async proposeArticleUpdate(id: string, dto: UpdateArticleDto, adminId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Article post with ID ${id} not found`);
    const sanitizedDto: any = { ...dto };
    if ('stockId' in dto) {
      sanitizedDto.stockId = await this.sanitizeStockId(dto.stockId);
    }
    return this.propose('ARTICLE', id, 'UPDATE', sanitizedDto, `Edit article: ${existing.title}`, adminId);
  }

  async proposeArticleDelete(id: string, adminId: string) {
    const existing = await this.prisma.article.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Article post with ID ${id} not found`);
    return this.propose('ARTICLE', id, 'DELETE', {}, `Delete article: ${existing.title}`, adminId);
  }

  /**
   * Get version history for news article
   * @param id - News article ID
   * @returns Version history
   */
  async getNewsVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('NEWS', id);
  }

  /**
   * Rollback news article to a specific version
   * @param id - News article ID
   * @param versionNumber - Version number to rollback to
   * @returns Updated news article
   */
  async rollbackNews(id: string, versionNumber: number) {
    // Get the version content to restore
    const versionContent = (await this.versioningService.rollbackToVersion(
      'NEWS',
      id,
      versionNumber,
    )) as any;

    // Update the news with the old content (excluding id, createdAt)
    const { id: _, createdAt, ...updateData } = versionContent;
    if ('stockId' in updateData) {
      updateData.stockId = await this.sanitizeStockId(updateData.stockId);
    }

    const news = await this.prisma.news.update({
      where: { id },
      data: updateData,
    });

    // Create a new version with changeType 'ROLLBACK'
    await this.versioningService.createVersion(
      'NEWS',
      news.id,
      news,
      'ROLLBACK',
    );

    return news;
  }

  /**
   * Get version history for article post
   * @param id - Article post ID
   * @returns Version history
   */
  async getArticleVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('ARTICLE', id);
  }

  /**
   * Rollback article post to a specific version
   * @param id - Article post ID
   * @param versionNumber - Version number to rollback to
   * @returns Updated article post
   */
  async rollbackArticle(id: string, versionNumber: number) {
    // Get the version content to restore
    const versionContent = (await this.versioningService.rollbackToVersion(
      'ARTICLE',
      id,
      versionNumber,
    )) as any;

    // Update the article with the old content (excluding id, createdAt)
    const { id: _, createdAt, ...updateData } = versionContent;
    if ('stockId' in updateData) {
      updateData.stockId = await this.sanitizeStockId(updateData.stockId);
    }

    const article = await this.prisma.article.update({
      where: { id },
      data: updateData,
    });

    // Create a new version with changeType 'ROLLBACK'
    await this.versioningService.createVersion(
      'ARTICLE',
      article.id,
      article,
      'ROLLBACK',
    );

    return article;
  }

  /**
   * Get unique categories from news articles
   */
  async getUniqueNewsCategories() {
    const news = await this.prisma.news.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    return news
      .map((n) => n.category)
      .filter((cat): cat is string => !!cat && cat.trim() !== '');
  }

  /**
   * Get unique categories from article posts
   */
  async getUniqueArticleCategories() {
    const articles = await this.prisma.article.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    return articles
      .map((a) => a.category)
      .filter((cat): cat is string => !!cat && cat.trim() !== '');
  }

  // CONTENT LIKES METHODS
  /**
   * Toggle like for a news or article item
   */
  async toggleContentLike(
    userId: string,
    contentType: 'news' | 'article',
    contentId: string,
  ) {
    if (contentType === 'news') {
      const existing = await this.prisma.contentLike.findUnique({
        where: {
          userId_contentType_newsId: {
            userId,
            contentType: 'news',
            newsId: contentId,
          },
        },
      });

      if (existing) {
        await this.prisma.contentLike.delete({
          where: { id: existing.id },
        });
        return { liked: false, contentType, contentId };
      } else {
        await this.prisma.contentLike.create({
          data: {
            userId,
            contentType: 'news',
            newsId: contentId,
          },
        });
        return { liked: true, contentType, contentId };
      }
    } else {
      const existing = await this.prisma.contentLike.findUnique({
        where: {
          userId_contentType_articleId: {
            userId,
            contentType: 'article',
            articleId: contentId,
          },
        },
      });

      if (existing) {
        await this.prisma.contentLike.delete({
          where: { id: existing.id },
        });
        return { liked: false, contentType, contentId };
      } else {
        await this.prisma.contentLike.create({
          data: {
            userId,
            contentType: 'article',
            articleId: contentId,
          },
        });
        return { liked: true, contentType, contentId };
      }
    }
  }

  /**
   * Get all liked items for a user
   */
  async getUserLikes(userId: string) {
    const likes = await this.prisma.contentLike.findMany({
      where: { userId },
      include: {
        news: true,
        article: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const likedIds: Record<string, boolean> = {};
    const likedItems: any[] = [];

    for (const like of likes) {
      if (like.contentType === 'news' && like.news) {
        likedIds[like.news.id] = true;
        likedItems.push({ ...like.news, contentType: 'news' });
      } else if (like.contentType === 'article' && like.article) {
        likedIds[like.article.id] = true;
        likedItems.push({ ...like.article, contentType: 'article' });
      }
    }

    return { likedIds, likedItems };
  }

  /**
   * Sync guest likes to authenticated user account upon login
   */
  async syncGuestLikes(
    userId: string,
    guestItems: Array<{ id: string; contentType: 'news' | 'article' }>,
  ) {
    for (const item of guestItems) {
      try {
        if (item.contentType === 'news') {
          await this.prisma.contentLike.upsert({
            where: {
              userId_contentType_newsId: {
                userId,
                contentType: 'news',
                newsId: item.id,
              },
            },
            create: {
              userId,
              contentType: 'news',
              newsId: item.id,
            },
            update: {},
          });
        } else if (item.contentType === 'article') {
          await this.prisma.contentLike.upsert({
            where: {
              userId_contentType_articleId: {
                userId,
                contentType: 'article',
                articleId: item.id,
              },
            },
            create: {
              userId,
              contentType: 'article',
              articleId: item.id,
            },
            update: {},
          });
        }
      } catch (e) {
        // ignore duplicate / invalid ID errors during bulk sync
      }
    }

    return await this.getUserLikes(userId);
  }
}
