import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSellRequestDto } from './dto/create-sell-request.dto';
import { UpdateSellRequestStatusDto } from './dto/update-sell-request-status.dto';
import { SellRequestStatus } from 'db-unlisted-stox';

/**
 * Sell Requests Service
 * Handles creation (user-facing) and management (admin/operations) of sell requests.
 */
@Injectable()
export class SellRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // Terminal statuses — a request is "closed" if it's in one of these
  private readonly TERMINAL_STATUSES: SellRequestStatus[] = [
    SellRequestStatus.ACCEPTED,
    SellRequestStatus.REJECTED,
  ];

  // Valid status transitions
  private readonly VALID_TRANSITIONS: Record<SellRequestStatus, SellRequestStatus[]> = {
    [SellRequestStatus.PENDING]: [
      SellRequestStatus.UNDER_REVIEW,
      SellRequestStatus.CONTACTED,
      SellRequestStatus.ACCEPTED,
      SellRequestStatus.REJECTED,
    ],
    [SellRequestStatus.UNDER_REVIEW]: [
      SellRequestStatus.CONTACTED,
      SellRequestStatus.NEGOTIATING,
      SellRequestStatus.ACCEPTED,
      SellRequestStatus.REJECTED,
    ],
    [SellRequestStatus.CONTACTED]: [
      SellRequestStatus.NEGOTIATING,
      SellRequestStatus.ACCEPTED,
      SellRequestStatus.REJECTED,
    ],
    [SellRequestStatus.NEGOTIATING]: [
      SellRequestStatus.ACCEPTED,
      SellRequestStatus.REJECTED,
    ],
    [SellRequestStatus.ACCEPTED]: [],
    [SellRequestStatus.REJECTED]: [],
  };

  /**
   * Create a new sell request (user-facing).
   * Validates user verification status and enforces one-active-request-per-stock rule.
   */
  async create(userId: string, dto: CreateSellRequestDto) {
    // 1. Fetch user and validate verification status
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kycStatus: true,
        dematStatus: true,
        bankStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== 'VERIFIED') {
      throw new ForbiddenException('KYC verification is required to sell stocks.');
    }
    if (user.dematStatus !== 'VERIFIED') {
      throw new ForbiddenException('Demat account verification is required to sell stocks.');
    }
    if (user.bankStatus !== 'VERIFIED') {
      throw new ForbiddenException('Bank account verification is required to sell stocks.');
    }

    // 2. Validate stock exists and is active
    const stock = await this.prisma.stock.findUnique({
      where: { id: dto.stockId },
    });

    if (!stock) {
      throw new NotFoundException(`Stock not found`);
    }

    if (!stock.isActive) {
      throw new BadRequestException('This stock is currently unavailable.');
    }

    // 3. Check no active (non-terminal) sell request for this user + stock
    const existingActive = await this.prisma.sellRequest.findFirst({
      where: {
        userId,
        stockId: dto.stockId,
        status: {
          notIn: this.TERMINAL_STATUSES,
        },
      },
    });

    if (existingActive) {
      throw new ConflictException(
        'You already have an active sell request for this stock. Please wait for it to be processed.',
      );
    }

    // 4. Create the sell request
    const totalAmount = dto.quantity * dto.pricePerShare;

    return this.prisma.sellRequest.create({
      data: {
        userId,
        stockId: dto.stockId,
        quantity: dto.quantity,
        pricePerShare: dto.pricePerShare,
        totalAmount,
      },
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            price: true,
          },
        },
      },
    });
  }

  /**
   * Get all sell requests for a specific user (for "My Sell Requests" dashboard).
   */
  async getUserSellRequests(userId: string) {
    return this.prisma.sellRequest.findMany({
      where: { userId },
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            price: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all sell requests (admin/operations facing).
   * Includes user details (name, email, phone) and stock info.
   */
  async getAllSellRequests(status?: SellRequestStatus) {
    const where = status ? { status } : {};

    return this.prisma.sellRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        stock: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            price: true,
            cin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update sell request status (admin/operations facing).
   * Validates status transitions and appends optional admin note.
   */
  async updateStatus(id: string, dto: UpdateSellRequestStatusDto) {
    const sellRequest = await this.prisma.sellRequest.findUnique({
      where: { id },
    });

    if (!sellRequest) {
      throw new NotFoundException('Sell request not found');
    }

    // Validate transition
    const currentStatus = sellRequest.status as SellRequestStatus;
    const validNextStatuses = this.VALID_TRANSITIONS[currentStatus];

    if (!validNextStatuses || !validNextStatuses.includes(dto.status as SellRequestStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${dto.status}. Valid transitions: ${validNextStatuses?.join(', ') || 'none (terminal state)'}`,
      );
    }

    return this.prisma.sellRequest.update({
      where: { id },
      data: {
        status: dto.status as SellRequestStatus,
        ...(dto.adminNote != null && { adminNote: dto.adminNote }),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        stock: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });
  }
}
