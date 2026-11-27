import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminContextService } from '../common/admin-context.service';

/**
 * Service for managing content versioning across all CMS entities
 * Provides create, retrieve, compare, and rollback functionality
 */
@Injectable()
export class VersioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminContextService: AdminContextService,
  ) {}

  /**
   * Create a new version for an entity
   * @param entityType The type of entity (e.g., 'STATIC_PAGE', 'STOCK')
   * @param entityId The ID of the entity
   * @param content Full snapshot of the entity content
   * @param changeType Type of change (CREATE, UPDATE, ROLLBACK)
   * @param changeNote Optional note about the change
   * @returns The created version record
   */
  async createVersion(
    entityType: string,
    entityId: string,
    content: any,
    changeType: string,
    changeNote?: string,
  ) {
    const adminContext = this.adminContextService.getContext();
    const createdById = adminContext?.adminId || 'system';
    const createdByEmail = adminContext?.email || 'system@.internal';
    const createdByRole = adminContext?.role || 'ADMIN';

    // Get the next version number
    const lastVersion = await this.prisma.contentVersion.findFirst({
      where: { entityType, entityId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    return this.prisma.contentVersion.create({
      data: {
        entityType,
        entityId,
        versionNumber: nextVersionNumber,
        content,
        changeType,
        changeNote,
        createdById,
        createdByEmail,
        createdByRole,
      },
    });
  }

  /**
   * Get version history for an entity
   * Works with both admin and CMS authentication contexts
   * @param entityType The type of entity
   * @param entityId The ID of the entity
   * @returns Array of version records ordered by version number descending
   */
  async getVersionHistory(entityType: string, entityId: string) {
    return this.prisma.contentVersion.findMany({
      where: { entityType, entityId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Get a specific version by version number
   * @param entityType The type of entity
   * @param entityId The ID of the entity
   * @param versionNumber The version number to retrieve
   * @returns The version record
   */
  async getVersionByNumber(
    entityType: string,
    entityId: string,
    versionNumber: number,
  ) {
    const version = await this.prisma.contentVersion.findUnique({
      where: {
        entityType_entityId_versionNumber: {
          entityType,
          entityId,
          versionNumber,
        },
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for entity ${entityType}:${entityId}`,
      );
    }

    return version;
  }

  /**
   * Compare two versions of an entity
   * @param entityType The type of entity
   * @param entityId The ID of the entity
   * @param fromVersion The version number to compare from
   * @param toVersion The version number to compare to
   * @returns Object containing both versions for comparison
   */
  async compareVersions(
    entityType: string,
    entityId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    const [from, to] = await Promise.all([
      this.getVersionByNumber(entityType, entityId, fromVersion),
      this.getVersionByNumber(entityType, entityId, toVersion),
    ]);

    return {
      from: {
        version: from.versionNumber,
        content: from.content,
        createdAt: from.createdAt,
        createdBy: from.createdByEmail,
      },
      to: {
        version: to.versionNumber,
        content: to.content,
        createdAt: to.createdAt,
        createdBy: to.createdByEmail,
      },
    };
  }

  /**
   * Get content snapshot for rollback
   * @param entityType The type of entity
   * @param entityId The ID of the entity
   * @param versionNumber The version number to rollback to
   * @returns The content snapshot that can be used to restore the entity
   */
  async rollbackToVersion(
    entityType: string,
    entityId: string,
    versionNumber: number,
  ) {
    const version = await this.getVersionByNumber(
      entityType,
      entityId,
      versionNumber,
    );
    return version.content;
  }
}
