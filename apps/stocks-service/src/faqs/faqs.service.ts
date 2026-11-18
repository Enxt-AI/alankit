import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VersioningService } from '../versioning/versioning.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Injectable()
export class FaqsService {
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

  async createFaq(dto: CreateFaqDto) {
    const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
    const dataToCreate: any = {
      title: dto.title,
      answer: dto.answer,
      category: dto.category,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      stockId: sanitizedStockId ?? null,
    };

    const faq = await this.prisma.faq.create({
      data: dataToCreate,
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
          },
        },
      },
    });

    await this.versioningService.createVersion('FAQ', faq.id, faq, 'CREATE');

    return faq;
  }

  async getAllFaqsAdmin(filters?: { stockId?: string }) {
    const where: any = {};
    if (filters?.stockId) {
      if (filters.stockId === '_none') {
        where.stockId = null;
      } else {
        where.stockId = filters.stockId;
      }
    }

    return this.prisma.faq.findMany({
      where,
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllActiveFaqs(filters?: { stockId?: string; category?: string }) {
    const where: any = { isActive: true };
    if (filters?.stockId) {
      where.stockId = filters.stockId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }

    return this.prisma.faq.findMany({
      where,
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        answer: true,
        category: true,
        stockId: true,
        stock: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getFaqById(id: string) {
    const faq = await this.prisma.faq.findUnique({
      where: { id },
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
          },
        },
      },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return faq;
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    await this.getFaqById(id); // Check existence

    const dataToUpdate: any = { ...dto };
    if ('stockId' in dto) {
      dataToUpdate.stockId = await this.sanitizeStockId(dto.stockId);
    }

    const faq = await this.prisma.faq.update({
      where: { id },
      data: dataToUpdate,
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
          },
        },
      },
    });

    await this.versioningService.createVersion('FAQ', faq.id, faq, 'UPDATE');

    return faq;
  }

  async deleteFaq(id: string) {
    await this.getFaqById(id); // Check existence

    await this.prisma.faq.delete({
      where: { id },
    });

    return { message: 'FAQ deleted successfully' };
  }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  async proposeCreate(dto: CreateFaqDto, adminId: string) {
    const sanitizedStockId = await this.sanitizeStockId(dto.stockId);
    const sanitizedDto = {
      ...dto,
      stockId: sanitizedStockId ?? null,
    };

    return this.prisma.changeRequest.create({
      data: {
        entityType: 'FAQ',
        entityId: null,
        proposedData: { action: 'CREATE', data: JSON.parse(JSON.stringify(sanitizedDto)), label: `Create FAQ: ${(dto as any)?.title ?? 'record'}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async proposeUpdate(id: string, dto: UpdateFaqDto, adminId: string) {
    await this.getFaqById(id);
    const sanitizedDto: any = { ...dto };
    if ('stockId' in dto) {
      sanitizedDto.stockId = await this.sanitizeStockId(dto.stockId);
    }

    return this.prisma.changeRequest.create({
      data: {
        entityType: 'FAQ',
        entityId: id,
        proposedData: { action: 'UPDATE', data: JSON.parse(JSON.stringify(sanitizedDto)), label: `Edit FAQ: ${(dto as any)?.title ?? id}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async proposeDelete(id: string, adminId: string) {
    await this.getFaqById(id);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'FAQ',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete FAQ: ${id}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  /**
   * Get version history for FAQ
   * @param id - FAQ ID
   * @returns Version history
   */
  async getFaqVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('FAQ', id);
  }

  /**
   * Rollback FAQ to a specific version
   * @param id - FAQ ID
   * @param versionNumber - Version number to rollback to
   * @returns Updated FAQ
   */
  async rollbackFaq(id: string, versionNumber: number) {
    // Get the version content to restore
    const versionContent = (await this.versioningService.rollbackToVersion(
      'FAQ',
      id,
      versionNumber,
    )) as any;

    // Update the FAQ with the old content (excluding id, createdAt)
    const { id: _, createdAt, ...updateData } = versionContent;

    const faq = await this.prisma.faq.update({
      where: { id },
      data: updateData,
    });

    // Create a new version with changeType 'ROLLBACK'
    await this.versioningService.createVersion('FAQ', faq.id, faq, 'ROLLBACK');

    return faq;
  }
}
