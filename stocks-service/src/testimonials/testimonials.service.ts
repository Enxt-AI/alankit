import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

/**
 * TestimonialsService handles all CRUD operations for the Testimonial entity.
 *
 * Design notes:
 * - Every mutation (create / update / delete) records a version snapshot via
 *   VersioningService so admins can review change history and rollback.
 * - The public endpoint only returns active testimonials, ordered newest-first.
 * - Admin/CMS endpoints return ALL testimonials regardless of isActive status.
 */
@Injectable()
export class TestimonialsService {
  constructor(
    private prisma: PrismaService,
    private versioningService: VersioningService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  /**
   * Create a new testimonial and record the initial version snapshot.
   */
  async createTestimonial(dto: CreateTestimonialDto) {
    const testimonial = await this.prisma.testimonial.create({
      data: dto,
    });

    // Record the initial version for audit / rollback purposes
    await this.versioningService.createVersion(
      'TESTIMONIAL',
      testimonial.id,
      testimonial,
      'CREATE',
    );

    return testimonial;
  }

  // ---------------------------------------------------------------------------
  // READ (Admin / CMS -- includes inactive)
  // ---------------------------------------------------------------------------

  /**
   * Return every testimonial (active and inactive), ordered newest-first.
   * Used by the CMS and Admin panels.
   */
  async getAllTestimonialsAdmin() {
    return this.prisma.testimonial.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // READ (Public -- active only)
  // ---------------------------------------------------------------------------

  /**
   * Return only active testimonials, ordered newest-first.
   * Used by the public-facing landing page.
   */
  async getAllActiveTestimonials() {
    return this.prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        designation: true,
        company: true,
        feedback: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // READ (Single)
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single testimonial by ID.
   * Throws NotFoundException when the ID does not match any row.
   */
  async getTestimonialById(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { id },
      select: {
        name: true,
        designation: true,
        company: true,
        feedback: true,
      },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return testimonial;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  /**
   * Update an existing testimonial and record a new version snapshot.
   * Verifies existence first to surface a clear 404 when the ID is invalid.
   */
  async updateTestimonial(id: string, dto: UpdateTestimonialDto) {
    // Ensure the testimonial exists before attempting to update
    await this.getTestimonialById(id);

    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data: dto,
    });

    await this.versioningService.createVersion(
      'TESTIMONIAL',
      testimonial.id,
      testimonial,
      'UPDATE',
    );

    return testimonial;
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  /**
   * Hard-delete a testimonial.
   * Verifies existence first to surface a clear 404 when the ID is invalid.
   */
  async deleteTestimonial(id: string) {
    // Ensure the testimonial exists before attempting to delete
    await this.getTestimonialById(id);

    await this.prisma.testimonial.delete({
      where: { id },
    });

    return { message: 'Testimonial deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // VERSIONING
  // ---------------------------------------------------------------------------

  /**
   * Retrieve the full version history for a specific testimonial.
   */
  async getTestimonialVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('TESTIMONIAL', id);
  }

  /**
   * Rollback a testimonial to a previous version snapshot.
   *
   * Steps:
   * 1. Retrieve the old version content from the versioning store.
   * 2. Strip auto-managed fields (id, createdAt) so Prisma does not reject them.
   * 3. Update the testimonial row with the restored data.
   * 4. Record a ROLLBACK version for audit purposes.
   */
  async rollbackTestimonial(id: string, versionNumber: number) {
    const versionContent = (await this.versioningService.rollbackToVersion(
      'TESTIMONIAL',
      id,
      versionNumber,
    )) as any;

    // Exclude auto-managed fields that must not be overwritten
    const { id: _, createdAt, ...updateData } = versionContent;

    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data: updateData,
    });

    // Record a ROLLBACK version so the audit trail is complete
    await this.versioningService.createVersion(
      'TESTIMONIAL',
      testimonial.id,
      testimonial,
      'ROLLBACK',
    );

    return testimonial;
  }
}
