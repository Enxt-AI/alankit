import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Content Controller
 * Handles HTTP endpoints for news and article management
 * Base route: /api/content
 */
@Controller('content')
export class ContentController {
  constructor(private contentService: ContentService) {}

  // NEWS - PUBLIC ENDPOINTS
  /**
   * GET /api/content/news
   * Get all active news articles (public)
   */
  @Get('news')
  @Public()
  async getAllActiveNews(
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('stockId') stockId?: string,
  ) {
    return await this.contentService.getAllActiveNews({
      category,
      startDate,
      endDate,
      stockId,
    });
  }

  /**
   * GET /api/content/news/:id
   * Get single news article by ID (public)
   */
  @Get('news/:id')
  @Public()
  async getNewsById(@Param('id') id: string) {
    return await this.contentService.getNewsById(id);
  }

  /**
   * GET /api/content/news/categories
   * Get unique categories for news articles
   */
  @Get('news/categories')
  @Public()
  async getNewsCategories() {
    return await this.contentService.getUniqueNewsCategories();
  }

  // NEWS - ADMIN ENDPOINTS
  /**
   * GET /api/content/news/admin/all
   * Get all news articles including inactive (admin only)
   */
  @Get('news/admin/all')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async getAllNewsAdmin() {
    return await this.contentService.getAllNewsAdmin();
  }

  /**
   * GET /api/content/news/cms/all
   * Get all news articles including inactive (CMS panel access with cms_panel_token)
   * Requires 'cms_news' permission
   */
  @Get('news/cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_news')
  async getAllNewsCms() {
    return await this.contentService.getAllNewsAdmin();
  }

  /**
   * POST /api/content/news/cms - Create news article (CMS panel access with cms_panel_token). Requires 'cms_news' permission.
   */
  @Post('news/cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_news')
  async createNewsCms(@Body() dto: CreateNewsDto, @Req() req: any) {
    const changeRequest = await this.contentService.proposeNewsCreate(dto, req.user.adminId);
    return { message: 'News creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/content/news/cms/:id - CMS: propose update, held for approval.
   */
  @Put('news/cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_news')
  async updateNewsCms(@Param('id') id: string, @Body() dto: UpdateNewsDto, @Req() req: any) {
    const changeRequest = await this.contentService.proposeNewsUpdate(id, dto, req.user.adminId);
    return { message: 'News update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/content/news/cms/:id - CMS: propose delete, stays live until approved.
   */
  @Delete('news/cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_news')
  async deleteNewsCms(@Param('id') id: string, @Req() req: any) {
    const changeRequest = await this.contentService.proposeNewsDelete(id, req.user.adminId);
    return { message: 'News deletion submitted for admin approval', changeRequest };
  }

  /**
   * GET /api/content/news/cms/:id/versions
   * Get version history for news article (CMS panel access with cms_panel_token)
   * No permissions guard needed for read-only version history
   */
  @Get('news/cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getNewsVersionHistoryCms(@Param('id') id: string) {
    return this.contentService.getNewsVersionHistory(id);
  }

  /**
   * POST /api/content/news/admin
   * Create news article (admin only)
   */
  @Post('news/admin')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async createNews(@Body() dto: CreateNewsDto) {
    return await this.contentService.createNews(dto);
  }

  /**
   * PUT /api/content/news/admin/:id
   * Update news article (admin only)
   */
  @Put('news/admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async updateNews(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return await this.contentService.updateNews(id, dto);
  }

  /**
   * DELETE /api/content/news/admin/:id
   * Delete news article (admin only - hard delete)
   */
  @Delete('news/admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async deleteNews(@Param('id') id: string) {
    return await this.contentService.deleteNews(id);
  }

  /**
   * GET /api/content/news/admin/:id/versions
   * Get version history for news article (admin only)
   */
  @Get('news/admin/:id/versions')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async getNewsVersionHistory(@Param('id') id: string) {
    return this.contentService.getNewsVersionHistory(id);
  }

  /**
   * POST /api/content/news/admin/:id/rollback/:versionNumber
   * Rollback news article to a specific version (admin only)
   */
  @Post('news/admin/:id/rollback/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async rollbackNews(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.contentService.rollbackNews(id, parseInt(versionNumber));
  }

  // ARTICLES - PUBLIC ENDPOINTS
  /**
   * GET /api/content/articles
   * Get all active articles (public)
   */
  @Get('articles')
  @Public()
  async getAllActiveArticles(
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('stockId') stockId?: string,
  ) {
    return await this.contentService.getAllActiveArticles({
      category,
      startDate,
      endDate,
      stockId,
    });
  }

  /**
   * GET /api/content/articles/:id
   * Get single article by ID (public)
   */
  @Get('articles/:id')
  @Public()
  async getArticleById(@Param('id') id: string) {
    return await this.contentService.getArticleById(id);
  }

  /**
   * GET /api/content/articles/categories
   * Get unique categories for article posts
   */
  @Get('articles/categories')
  @Public()
  async getArticleCategories() {
    return await this.contentService.getUniqueArticleCategories();
  }

  // ARTICLES - ADMIN ENDPOINTS
  /**
   * GET /api/content/articles/admin/all
   * Get all articles including inactive (admin only)
   */
  @Get('articles/admin/all')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async getAllArticlesAdmin() {
    return await this.contentService.getAllArticlesAdmin();
  }

  /**
   * GET /api/content/articles/cms/all
   * Get all articles including inactive (CMS panel access with cms_panel_token)
   * Requires 'cms_articles' permission
   */
  @Get('articles/cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_articles')
  async getAllArticlesCms() {
    return await this.contentService.getAllArticlesAdmin();
  }

  /**
   * POST /api/content/articles/cms - Create article post (CMS panel access with cms_panel_token). Requires 'cms_articles' permission.
   */
  @Post('articles/cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_articles')
  async createArticleCms(@Body() dto: CreateArticleDto, @Req() req: any) {
    const changeRequest = await this.contentService.proposeArticleCreate(dto, req.user.adminId);
    return { message: 'Article creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/content/articles/cms/:id - CMS: propose update, held for approval.
   */
  @Put('articles/cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_articles')
  async updateArticleCms(@Param('id') id: string, @Body() dto: UpdateArticleDto, @Req() req: any) {
    const changeRequest = await this.contentService.proposeArticleUpdate(id, dto, req.user.adminId);
    return { message: 'Article update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/content/articles/cms/:id - CMS: propose delete, stays live until approved.
   */
  @Delete('articles/cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_articles')
  async deleteArticleCms(@Param('id') id: string, @Req() req: any) {
    const changeRequest = await this.contentService.proposeArticleDelete(id, req.user.adminId);
    return { message: 'Article deletion submitted for admin approval', changeRequest };
  }

  /**
   * GET /api/content/articles/cms/:id/versions
   * Get version history for article post (CMS panel access with cms_panel_token)
   * No permissions guard needed for read-only version history
   */
  @Get('articles/cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getArticleVersionHistoryCms(@Param('id') id: string) {
    return this.contentService.getArticleVersionHistory(id);
  }

  /**
   * POST /api/content/articles/admin
   * Create article post (admin only)
   */
  @Post('articles/admin')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async createArticle(@Body() dto: CreateArticleDto) {
    return await this.contentService.createArticle(dto);
  }

  /**
   * PUT /api/content/articles/admin/:id
   * Update article post (admin only)
   */
  @Put('articles/admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async updateArticle(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return await this.contentService.updateArticle(id, dto);
  }

  /**
   * DELETE /api/content/articles/admin/:id
   * Delete article post (admin only - hard delete)
   */
  @Delete('articles/admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async deleteArticle(@Param('id') id: string) {
    return await this.contentService.deleteArticle(id);
  }

  /**
   * GET /api/content/articles/admin/:id/versions
   * Get version history for article post (admin only)
   */
  @Get('articles/admin/:id/versions')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async getArticleVersionHistory(@Param('id') id: string) {
    return this.contentService.getArticleVersionHistory(id);
  }

  /**
   * POST /api/content/articles/admin/:id/rollback/:versionNumber
   * Rollback article post to a specific version (admin only)
   */
  @Post('articles/admin/:id/rollback/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async rollbackArticle(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.contentService.rollbackArticle(id, parseInt(versionNumber));
  }

  // USER CONTENT LIKES ENDPOINTS
  /**
   * POST /api/content/likes/toggle
   * Toggle like for news or article (user authenticated)
   */
  @Post('likes/toggle')
  @UseGuards(UserJwtAuthGuard)
  async toggleLike(
    @Req() req: any,
    @Body() body: { contentType: 'news' | 'article'; contentId: string },
  ) {
    const userId = req.user.userId;
    return await this.contentService.toggleContentLike(
      userId,
      body.contentType,
      body.contentId,
    );
  }

  /**
   * GET /api/content/likes/my-likes
   * Get all liked news and articles for authenticated user
   */
  @Get('likes/my-likes')
  @UseGuards(UserJwtAuthGuard)
  async getMyLikes(@Req() req: any) {
    const userId = req.user.userId;
    return await this.contentService.getUserLikes(userId);
  }

  /**
   * POST /api/content/likes/sync
   * Bulk sync guest likes to user account upon login
   */
  @Post('likes/sync')
  @UseGuards(UserJwtAuthGuard)
  async syncGuestLikes(
    @Req() req: any,
    @Body() body: { items: Array<{ id: string; contentType: 'news' | 'article' }> },
  ) {
    const userId = req.user.userId;
    return await this.contentService.syncGuestLikes(userId, body.items || []);
  }
}
