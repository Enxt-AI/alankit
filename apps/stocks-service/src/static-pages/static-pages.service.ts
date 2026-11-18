import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'db-unlistedstock';
import { PrismaService } from '../prisma/prisma.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { UpdateStaticPageDto } from './dto/update-static-page.dto';
import { triggerFrontendRevalidation } from './revalidation.helper';

/**
 * Service for managing static pages (About Us, Contact, Terms & Conditions, etc.)
 * Provides CRUD operations with versioning support
 */
@Injectable()
export class StaticPagesService {
  private readonly logger = new PinoNestLogger('stocks-service', 'StaticPagesService');
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioningService: VersioningService,
    private readonly configService: ConfigService,
  ) {}

  /** Fire-and-forget revalidation of the frontend cache for the given slug. */
  private revalidate(slug: string): void {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const secret = this.configService.get<string>('REVALIDATION_SECRET', '');
    if (!secret) {
      // Use Nestvia console to surface misconfiguration
      this.logger.warn(`[StaticPagesService] REVALIDATION_SECRET empty - skipping revalidation for slug "${slug}"`);
      return;
   }
    if (!frontendUrl || frontendUrl.includes('localhost')) {
      this.logger.warn(`[StaticPagesService] FRONTEND_URL="${frontendUrl}" looks like localhost - revalidation for "${slug}" will fail in production`);
   }
    // Fire-and-forget but attach error logging
    triggerFrontendRevalidation(slug, frontendUrl, secret).catch((err) =>
      this.logger.error(`[StaticPagesService] revalidation error for "${slug}":`, err),
    );
 }

  /**
   * Create a new static page (Admin only)
   * @param dto The page data
   * @param adminId The ID of the admin creating the page
   * @returns The created page
   */
  async createStaticPage(dto: CreateStaticPageDto, adminId: string) {
    // Check for duplicate slug
    const existing = await this.prisma.staticPage.findUnique({
      where: { slug: dto.slug },
   });

    if (existing) {
      throw new ConflictException(
        `Static page with slug '${dto.slug}' already exists`,
      );
   }

    // Destructure performanceMetrics and cast it to Prisma-compatible InputJsonValue.
    // Prisma's Json type requires plain objects/arrays, not class instances.
    const { performanceMetrics, ...restDto } = dto;

    const result = await this.prisma.staticPage.create({
      data: {
        ...restDto,
        createdById: adminId,
        // Cast the metrics array to Prisma.InputJsonValue for Prisma Json column compatibility
        ...(performanceMetrics !== undefined && {
          performanceMetrics: performanceMetrics as unknown as Prisma.InputJsonValue,
       }),
     },
   });

    // Create version snapshot
    await this.versioningService.createVersion(
      'STATIC_PAGE',
      result.id,
      result,
      'CREATE',
    );

    // Trigger on-demand frontend cache revalidation
    this.revalidate(dto.slug);

    return result;
 }

  /**
   * Get all static pages including inactive (Admin only)
   * @returns Array of all static pages
   */
  async getAllStaticPagesAdmin() {
    try {
      const result = this.prisma.staticPage.findMany({
        orderBy: { createdAt: 'desc' },
     });
      return result;
   } catch (error) {
      this.logger.log('Error fetching all static pages for admin:', error);
      return { message: 'An error occurred while fetching static pages.' };
   }
 }

  /**
   * Update an existing static page (Admin only)
   * @param id The page ID
   * @param dto The update data
   * @param adminId The ID of the admin updating the page
   * @returns The updated page
   */
  async updateStaticPage(
    id: string,
    dto: UpdateStaticPageDto,
    adminId: string,
  ) {
    // Ensure page exists
    const existing = await this.getStaticPageById(id);

    // Check for duplicate slug if slug is being updated
    if (dto.slug && dto.slug !== existing.slug) {
      const duplicate = await this.prisma.staticPage.findUnique({
        where: { slug: dto.slug },
     });
      if (duplicate) {
        throw new ConflictException(
          `Static page with slug '${dto.slug}' already exists`,
        );
     }
   }

    // Destructure performanceMetrics and cast it to Prisma-compatible InputJsonValue.
    // Prisma's Json type requires plain objects/arrays, not class instances.
    const { performanceMetrics, ...restDto } = dto;

    const result = await this.prisma.staticPage.update({
      where: { id },
      data: {
        ...restDto,
        updatedById: adminId,
        // Cast the metrics array to Prisma.InputJsonValue for Prisma Json column compatibility
        ...(performanceMetrics !== undefined && {
          performanceMetrics: performanceMetrics as unknown as Prisma.InputJsonValue,
       }),
     },
   });

    // Create version snapshot
    await this.versioningService.createVersion(
      'STATIC_PAGE',
      id,
      result,
      'UPDATE',
    );

    // Trigger on-demand frontend cache revalidation
    // Use the updated slug if changed, otherwise the original slug
    this.revalidate(dto.slug ?? existing.slug);

    return result;
 }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  async proposeCreate(dto: CreateStaticPageDto, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STATIC_PAGE',
        entityId: null,
        proposedData: { action: 'CREATE', data: JSON.parse(JSON.stringify(dto)), label: `Create page: ${(dto as any)?.title ?? (dto as any)?.slug ?? 'record'}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeUpdate(id: string, dto: UpdateStaticPageDto, adminId: string) {
    const existing = await this.getStaticPageById(id);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STATIC_PAGE',
        entityId: id,
        proposedData: { action: 'UPDATE', data: JSON.parse(JSON.stringify(dto)), label: `Edit page: ${existing.title}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeDelete(id: string, adminId: string) {
    const existing = await this.getStaticPageById(id);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STATIC_PAGE',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete page: ${existing.title}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  /**
   * Delete a static page (Admin only)
   * @param id The page ID
   * @returns Success message
   */
  async deleteStaticPage(id: string) {
    // Ensure page exists – capture slug before deletion
    const page = await this.getStaticPageById(id);

    await this.prisma.staticPage.delete({
      where: { id },
   });

    // Trigger on-demand frontend cache revalidation
    this.revalidate(page.slug);

    return { message: 'Static page deleted successfully' };
 }

  /**
   * Get all active static pages (Public)
   * @returns Array of active static pages
   */
  async getAllActiveStaticPages() {
    return this.prisma.staticPage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        slug: true,
        title: true,
        content: true,
        metaTitle: true,
        metaDescription: true,
        performanceMetrics: true,
     },
   });
 }

  /**
   * Private helper to find a static page by slug or throw NotFoundException
   * @param slug The page slug
   * @returns The static page
   */
  private async findStaticPageBySlugOrThrow(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
   });

    if (!page) {
      throw new NotFoundException(`Static page '${slug}' not found`);
   }

    return page;
 }

  /**
   * Get a static page by slug (Public)
   * @param slug The page slug
   * @returns The static page
   */
  async getStaticPageBySlug(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        content: true,
        metaTitle: true,
        metaDescription: true,
        performanceMetrics: true,
        isActive: true,
     },
   });

    if (!page || !page.isActive) {
      throw new NotFoundException(`Static page '${slug}' not found`);
   }

    const { isActive, ...cleanPage } = page;
    return cleanPage;
 }

  /**
   * Get a static page by slug for CMS editing (allows inactive pages)
   * @param slug The page slug
   * @returns The static page
   */
  async getStaticPageBySlugCms(slug: string) {
    return this.findStaticPageBySlugOrThrow(slug);
 }

  /**
   * Get a static page by slug for Admin editing (allows inactive pages)
   * @param slug The page slug
   * @returns The static page
   */
  async getStaticPageBySlugAdmin(slug: string) {
    return this.findStaticPageBySlugOrThrow(slug);
 }

  /**
   * Get a static page by ID (Admin only)
   * @param id The page ID
   * @returns The static page
   */
  async getStaticPageById(id: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
   });

    if (!page) {
      throw new NotFoundException(`Static page with ID '${id}' not found`);
   }

    return page;
 }

  /**
   * Get version history for a static page (Admin only)
   * @param id The page ID
   * @returns Array of page versions
   */
  async getStaticPageVersions(id: string) {
    // Ensure page exists
    await this.getStaticPageById(id);

    return this.versioningService.getVersionHistory('STATIC_PAGE', id);
 }

  /**
   * Rollback a static page to a specific version (Admin only)
   * @param id The page ID
   * @param versionNumber The version number to rollback to
   * @param adminId The ID of the admin performing the rollback
   * @returns The updated page
   */
  async rollbackStaticPage(id: string, versionNumber: number, adminId: string) {
    // Ensure page exists
    await this.getStaticPageById(id);

    // Get the version content to restore
    const versionContent = (await this.versioningService.rollbackToVersion(
      'STATIC_PAGE',
      id,
      versionNumber,
    )) as any;

    // Update the page with the old content (excluding immutable/system-managed fields)
    const {
      id: _,
      createdAt,
      updatedAt,
      createdById,
      slug,
      ...updateData
   } = versionContent;

    const result = await this.prisma.staticPage.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: adminId,
     },
   });

    // Create a new version snapshot for the rollback
    await this.versioningService.createVersion(
      'STATIC_PAGE',
      id,
      result,
      'ROLLBACK',
    );

    // Trigger on-demand frontend cache revalidation
    this.revalidate(result.slug);

    return result;
 }
}
