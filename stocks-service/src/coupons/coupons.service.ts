import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PinoNestLogger } from '@smc/logger';

@Injectable()
export class CouponsService {
  private readonly logger = new PinoNestLogger('stocks-service', 'CouponsService');
  constructor(private prisma: PrismaService) {}

  /**
   * Generates a new coupon. Used by RM.
   * @param internalRmId - set if RM is internal (SMC branch RM)
   * @param distributorRmId - set if RM is external (distributor RM)
   */
  async generateCoupon(
    internalRmId: string | null,
    distributorRmId: string | null,
    stockId: string,
    minQuantity: number,
    maxQuantity: number,
    discountAmount: number,
    assignedUserId?: string,
    expiresAt?: Date,
    discountType: string = 'FIXED',
    discountPercentage?: number,
    isAdmin: boolean = false,
    customCode?: string,
    adminContext?: { adminId: string; adminEmail?: string; adminRole?: string; adminName?: string },
    redemptionType: 'ONCE' | 'UNLIMITED' = 'UNLIMITED',
    mapToMarketing: boolean = false,
  ) {
    // Validate stock
    const stock = await this.prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) throw new NotFoundException('Stock not found');

    // Admin promotional coupons MUST have an expiration date
    if (isAdmin) {
      if (!expiresAt) {
        throw new BadRequestException('Expiration date is required when creating an admin promotional coupon.');
      }
      if (new Date(expiresAt) <= new Date()) {
        throw new BadRequestException('Expiration date must be in the future.');
      }
    }

    const numMinQty = Number(minQuantity);
    const numMaxQty = Number(maxQuantity);

    if (isNaN(numMinQty) || numMinQty <= 0) {
      throw new BadRequestException('Minimum quantity must be a valid positive number');
    }

    if (isNaN(numMaxQty) || numMaxQty <= 0) {
      throw new BadRequestException('Maximum quantity must be a valid positive number');
    }

    if (stock.minimumPurchaseQuantity && numMinQty < stock.minimumPurchaseQuantity) {
      throw new BadRequestException(`Minimum quantity cannot be less than the stock's minimum purchase quantity (${stock.minimumPurchaseQuantity})`);
    }

    if (stock.maximumPurchaseQuantity && numMaxQty > stock.maximumPurchaseQuantity) {
      throw new BadRequestException(`Maximum quantity cannot be greater than the stock's maximum purchase quantity (${stock.maximumPurchaseQuantity})`);
    }

    if (numMinQty > numMaxQty) {
      throw new BadRequestException('Minimum quantity cannot be greater than maximum quantity');
    }

    let effectiveDiscountAmount = discountAmount;

    if (discountType === 'PERCENTAGE') {
      if (!discountPercentage || discountPercentage <= 0 || discountPercentage > 100) {
        throw new BadRequestException('Valid discount percentage (0.01 - 100) is required for percentage discounts');
      }
      // Calculate effective discount amount at minQuantity for validation
      effectiveDiscountAmount = (stock.price * minQuantity) * (discountPercentage / 100);
      discountAmount = 0; // Flat discount is 0 for percentage coupons
    } else {
      if (discountAmount <= 0) {
        throw new BadRequestException('Discount amount per share must be strictly greater than 0');
      }
      // For FIXED discounts, validate against stock price
      if (discountAmount > stock.price) {
        throw new BadRequestException(`Flat discount (₹${discountAmount}) cannot exceed the stock price (₹${stock.price})`);
      }
    }

    // Minimum lending price floor:
    // Only enforced for RM generated coupons.
    const isExternal = !!distributorRmId;
    const effectiveLendingPrice = isExternal
      ? stock.externalLendingPrice
      : stock.internalLendingPrice;

    // Admin promotional coupons bypass lending price floor (supports up to 100% discount).
    if (!isAdmin) {
      if (effectiveLendingPrice) {
        const minSellingPrice = stock.price - (effectiveDiscountAmount / minQuantity);
        if (minSellingPrice < effectiveLendingPrice) {
          throw new BadRequestException(
            `Discount is too high. Selling price per share (₹${minSellingPrice.toFixed(2)}) cannot fall below the minimum landing price (₹${effectiveLendingPrice.toFixed(2)})`
          );
        }
      }
    }

    let code = customCode ? customCode.trim().toUpperCase() : '';
    if (code) {
      // Validate custom code format (alphanumeric and hyphens only, min 3 chars, max 20 chars)
      if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
        throw new BadRequestException('Custom coupon code must be between 3-20 uppercase alphanumeric characters or hyphens.');
      }
      // Check code uniqueness
      const existing = await this.prisma.coupon.findUnique({ where: { code } });
      if (existing) {
        throw new BadRequestException(`Coupon code "${code}" is already in use. Please enter a different code.`);
      }
    } else {
      // Auto-generate code
      const cleanStockName = stock.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `SMC-${cleanStockName}-${randomSuffix}`;
        const existing = await this.prisma.coupon.findUnique({ where: { code } });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new BadRequestException('Failed to generate a unique referral code. Please try again.');
      }
    }

    const newCoupon = await this.prisma.coupon.create({
      data: {
        code,
        internalRmId,
        distributorRmId,
        stockId,
        minQuantity: numMinQty,
        maxQuantity: numMaxQty,
        discountAmount,
        discountType,
        discountPercentage,
        lendingPrice: effectiveLendingPrice ?? null,
        expiresAt,
        assignedUserId: assignedUserId || null,
      },
      select: {
        id: true,
        code: true,
        stockId: true,
        minQuantity: true,
        maxQuantity: true,
        discountAmount: true,
        discountType: true,
        discountPercentage: true,
        lendingPrice: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (isAdmin && adminContext) {
      try {
        await this.prisma.auditLog.create({
          data: {
            adminId: adminContext.adminId || 'unknown',
            adminEmail: adminContext.adminEmail || '',
            adminRole: adminContext.adminRole || 'SUPER_ADMIN',
            action: 'CREATE',
            entity: 'COUPON',
            entityId: newCoupon.id,
            changes: {
              code: newCoupon.code,
              stockId: newCoupon.stockId,
              discountAmount: newCoupon.discountAmount,
              discountType: newCoupon.discountType,
              discountPercentage: newCoupon.discountPercentage,
              minQuantity: newCoupon.minQuantity,
              maxQuantity: newCoupon.maxQuantity,
              expiresAt: newCoupon.expiresAt,
              redemptionType,
              mapToMarketing,
            },
            metadata: {
              adminName: adminContext.adminName || adminContext.adminEmail || 'Super Admin',
              adminRole: adminContext.adminRole || 'SUPER_ADMIN',
              code: newCoupon.code,
              redemptionType,
              mapToMarketing,
            },
          },
        });
      } catch (auditErr) {
        this.logger.error('Failed to create audit log for coupon creation:', auditErr);
      }
    }

    return {
      ...newCoupon,
      redemptionType,
      mapToMarketing,
    };
  }

  /**
   * Validates a coupon code during checkout and provides the discount amount.
   */
  async validateCoupon(code: string, stockId: string, quantity: number, userId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: {
        stock: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Invalid coupon code');
    }

    const isDirectAdmin = !coupon.internalRmId && !coupon.distributorRmId;

    if (isDirectAdmin) {
      // Expiration check is strictly enforced for admin promotional coupons
      if (!coupon.expiresAt || new Date() > coupon.expiresAt) {
        throw new BadRequestException('This promotional coupon has expired.');
      }

      // Check redemption type from audit log
      const auditLog = await this.prisma.auditLog.findFirst({
        where: {
          entity: 'COUPON',
          action: 'CREATE',
          OR: [
            { entityId: coupon.id },
            { metadata: { path: ['code'], equals: coupon.code } },
          ],
        },
      });

      const redemptionType =
        (auditLog?.metadata as any)?.redemptionType ||
        (auditLog?.changes as any)?.redemptionType ||
        'UNLIMITED';

      if (redemptionType === 'ONCE') {
        // One-time use: can only be redeemed once in total across the entire platform
        if (coupon.isUsed) {
          throw new BadRequestException('This one-time promotional coupon has already been redeemed.');
        }

        const alreadyRedeemed = await this.prisma.order.findFirst({
          where: {
            couponId: coupon.id,
            status: { in: ['PAID', 'ALLOCATED', 'COMPLETED'] },
          },
        });
        if (alreadyRedeemed) {
          throw new BadRequestException('This one-time promotional coupon has already been redeemed.');
        }
      }
      // If UNLIMITED: multiple users and orders can redeem it multiple times / infinite times until coupon.expiresAt!
    } else {
      // Single-use RM referral code
      if (coupon.isUsed) {
        throw new BadRequestException('This referral code has already been used.');
      }

      if (coupon.expiresAt && new Date() > coupon.expiresAt) {
        throw new BadRequestException('This referral code has expired.');
      }
    }

    if (coupon.stockId !== stockId) {
      throw new BadRequestException('This referral code is not applicable to the selected stock.');
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new BadRequestException('Valid purchase quantity is required to apply referral code.');
    }

    if (coupon.minQuantity != null && numQty < coupon.minQuantity) {
      throw new BadRequestException(`Minimum quantity of ${coupon.minQuantity} shares required to use this referral code.`);
    }

    if (coupon.maxQuantity != null && numQty > coupon.maxQuantity) {
      throw new BadRequestException(`Maximum quantity allowed for this referral code is ${coupon.maxQuantity} shares.`);
    }

    if (coupon.assignedUserId && coupon.assignedUserId !== userId) {
       throw new BadRequestException('This referral code is not assigned to your account.');
    }

    const stock = coupon.stock;
    
    if (stock.minimumPurchaseQuantity && quantity < stock.minimumPurchaseQuantity) {
       throw new BadRequestException(`Purchase quantity does not meet the stock's current minimum requirement of ${stock.minimumPurchaseQuantity} shares.`);
    }

    if (stock.maximumPurchaseQuantity && quantity > stock.maximumPurchaseQuantity) {
       throw new BadRequestException(`Purchase quantity exceeds the stock's current maximum allowed limit of ${stock.maximumPurchaseQuantity} shares.`);
    }
    
    let effectiveUnitPrice = stock.price;
    if (stock.discountSlabs && Array.isArray(stock.discountSlabs) && stock.discountSlabs.length > 0) {
      const totalPurchaseAmount = stock.price * quantity;
      const slabs = (stock.discountSlabs as { minAmount: number; pricePerShare: number }[])
        .filter((s) => typeof s.minAmount === 'number' && typeof s.pricePerShare === 'number' && s.pricePerShare > 0)
        .sort((a, b) => b.minAmount - a.minAmount);
      const matched = slabs.find((s) => totalPurchaseAmount >= s.minAmount);
      if (matched) {
        effectiveUnitPrice = matched.pricePerShare;
      }
    }

    let computedDiscountAmount = coupon.discountAmount * quantity;
    if (coupon.discountType === 'PERCENTAGE' && coupon.discountPercentage) {
      computedDiscountAmount = (effectiveUnitPrice * quantity) * (coupon.discountPercentage / 100);
    }

    return {
      isValid: true,
      couponId: coupon.id,
      discountAmount: computedDiscountAmount,
      discountAmountPerShare: coupon.discountAmount,
      code: coupon.code,
      discountType: coupon.discountType,
      discountPercentage: coupon.discountPercentage,
      minQuantity: coupon.minQuantity,
      maxQuantity: coupon.maxQuantity,
    };
  }

  /**
   * Deletes a coupon provided it has not been used.
   * Admins can delete any unredeemed coupon; RMs can only delete their own unredeemed coupons.
   * Redeemed coupons are strictly immutable and cannot be deleted.
   */
  async deleteCoupon(id: string, rmId?: string, isAdmin: boolean = false) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!isAdmin) {
      if (coupon.internalRmId !== rmId && coupon.distributorRmId !== rmId) {
        throw new BadRequestException('You are not authorized to delete this coupon');
      }
    }

    if (coupon.isUsed) {
      throw new BadRequestException('Cannot delete a coupon that has already been redeemed');
    }

    // Check if any order has redeemed this coupon
    const orderRedeemed = await this.prisma.order.findFirst({
      where: {
        couponId: coupon.id,
        status: { in: ['PAID', 'ALLOCATED', 'COMPLETED'] },
      },
    });
    if (orderRedeemed) {
      throw new BadRequestException('Cannot delete a promotional coupon that has already been redeemed by customers');
    }

    return await this.prisma.coupon.delete({ where: { id } });
  }

  /**
   * Toggles whether a coupon is mapped to the marketing panel.
   */
  async toggleMarketingMapping(
    id: string,
    mapToMarketing: boolean,
    adminContext: { adminId: string; adminEmail?: string; adminRole?: string; adminName?: string },
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const existingLog = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'COUPON',
        action: 'CREATE',
        OR: [
          { entityId: coupon.id },
          { metadata: { path: ['code'], equals: coupon.code } },
        ],
      },
    });

    if (existingLog) {
      await this.prisma.auditLog.update({
        where: { id: existingLog.id },
        data: {
          metadata: {
            ...((existingLog.metadata as any) || {}),
            mapToMarketing,
          },
          changes: {
            ...((existingLog.changes as any) || {}),
            mapToMarketing,
          },
        },
      });
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          adminId: adminContext.adminId || 'unknown',
          adminEmail: adminContext.adminEmail || '',
          adminRole: adminContext.adminRole || 'SUPER_ADMIN',
          action: 'UPDATE',
          entity: 'COUPON',
          entityId: coupon.id,
          changes: { mapToMarketing },
          metadata: {
            code: coupon.code,
            mapToMarketing,
            adminName: adminContext.adminName || 'Super Admin',
          },
        },
      });
    } catch (e) {
      this.logger.error('Failed to log audit update for marketing mapping:', e);
    }

    return {
      ...coupon,
      mapToMarketing,
    };
  }

  /**
   * Retrieves a single coupon by ID or Code with full sales & redemption analytics.
   */
  async getCouponById(
    id: string,
    internalRmId: string | null,
    distributorRmId: string | null,
    isAdmin: boolean = false,
  ) {
    let coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        stock: true,
        assignedUser: true,
        usedByUser: true,
        order: true,
        internalRm: {
          include: {
            branch: true,
          },
        },
        distributorRm: {
          include: {
            distributor: true,
          },
        },
      },
    });

    if (!coupon) {
      // Fallback: search by coupon code
      coupon = await this.prisma.coupon.findFirst({
        where: { code: id },
        include: {
          stock: true,
          assignedUser: true,
          usedByUser: true,
          order: true,
          internalRm: {
            include: {
              branch: true,
            },
          },
          distributorRm: {
            include: {
              distributor: true,
            },
          },
        },
      });
    }

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!isAdmin) {
      if (coupon.internalRmId !== internalRmId && coupon.distributorRmId !== distributorRmId) {
        throw new BadRequestException('You are not authorized to view this coupon');
      }
    }

    // Fetch all linked orders for this coupon
    const orders = await this.prisma.order.findMany({
      where: { couponId: coupon.id },
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
            isin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fallback for older single-use coupons where coupon.order was linked directly
    if (coupon.order && !orders.some((o) => o.id === coupon.order?.id)) {
      orders.push({
        ...coupon.order,
        user: coupon.usedByUser
          ? {
              id: coupon.usedByUser.id,
              fullName: coupon.usedByUser.fullName,
              email: coupon.usedByUser.email,
              phone: (coupon.usedByUser as any).phone || null,
            }
          : null,
        stock: coupon.stock
          ? {
              id: coupon.stock.id,
              name: coupon.stock.name,
              price: coupon.stock.price,
              isin: coupon.stock.isin,
            }
          : null,
      } as any);
    }

    const paidOrders = orders.filter((o) =>
      ['PAID', 'ALLOCATED', 'COMPLETED'].includes(o.status)
    );

    const isDirectAdmin = !coupon.internalRmId && !coupon.distributorRmId;

    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'COUPON',
        action: 'CREATE',
        OR: [
          { entityId: coupon.id },
          { metadata: { path: ['code'], equals: coupon.code } },
        ],
      },
      orderBy: { timestamp: 'desc' },
    });

    const redemptionType: 'ONCE' | 'UNLIMITED' =
      (auditLog?.metadata as any)?.redemptionType ||
      (auditLog?.changes as any)?.redemptionType ||
      (isDirectAdmin ? 'UNLIMITED' : 'ONCE');

    const mapToMarketing: boolean =
      (auditLog?.metadata as any)?.mapToMarketing ??
      (auditLog?.changes as any)?.mapToMarketing ??
      false;

    const isRedeemed = isDirectAdmin
      ? (redemptionType === 'ONCE' ? (paidOrders.length > 0 || coupon.isUsed) : false)
      : coupon.isUsed;
    const redemptionCount = isDirectAdmin ? paidOrders.length : (coupon.isUsed ? 1 : 0);

    const uniqueUsersMap = new Map<string, any>();
    for (const ord of paidOrders) {
      if (ord.user && ord.user.id) {
        uniqueUsersMap.set(ord.user.id, ord.user);
      } else if (ord.userId) {
        uniqueUsersMap.set(ord.userId, { id: ord.userId });
      }
    }

    const totalSharesSold = paidOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const totalGrossRevenue = paidOrders.reduce(
      (sum, o) => sum + (o.originalTotalAmount || ((o.pricePerShare || 0) * (o.quantity || 0)) || o.totalAmount || 0),
      0
    );
    const totalDiscountDisbursed = paidOrders.reduce((sum, o) => sum + (o.discountApplied || 0), 0);
    const totalNetSales = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const relationshipManager = coupon.distributorRm
      ? {
          id: coupon.distributorRm.id,
          name: coupon.distributorRm.name,
          email: coupon.distributorRm.email,
          distributor: coupon.distributorRm.distributor?.name || 'Distributor',
        }
      : coupon.internalRm
      ? {
          id: coupon.internalRm.id,
          name: coupon.internalRm.name,
          email: coupon.internalRm.email,
          branch: coupon.internalRm.branch?.name || 'Branch',
        }
      : null;

    let createdBy: {
      id?: string;
      name: string;
      email?: string;
      role: string;
      type: 'ADMIN' | 'RM' | 'DISTRIBUTOR_RM';
      createdAt?: string;
    } | null = null;

    if (isDirectAdmin) {
      if (auditLog) {
        let adminName = (auditLog.metadata as any)?.adminName;
        let adminRole = auditLog.adminRole || 'SUPER_ADMIN';
        let adminEmail = auditLog.adminEmail;

        if (auditLog.adminId && auditLog.adminId !== 'unknown') {
          const admin = await this.prisma.admin.findUnique({
            where: { id: auditLog.adminId },
            select: { fullName: true, email: true, role: true },
          });
          if (admin) {
            adminName = admin.fullName;
            adminRole = admin.role;
            adminEmail = admin.email;
          }
        }

        createdBy = {
          id: auditLog.adminId,
          name: adminName || adminEmail?.split('@')[0] || 'Super Admin',
          email: adminEmail,
          role: adminRole,
          type: 'ADMIN',
          createdAt: auditLog.timestamp?.toISOString(),
        };
      } else {
        createdBy = null;
      }
    } else if (coupon.internalRm) {
      createdBy = {
        id: coupon.internalRm.id,
        name: coupon.internalRm.name,
        email: coupon.internalRm.email,
        role: 'BRANCH_RM',
        type: 'RM',
      };
    } else if (coupon.distributorRm) {
      createdBy = {
        id: coupon.distributorRm.id,
        name: coupon.distributorRm.name,
        email: coupon.distributorRm.email,
        role: 'DISTRIBUTOR_RM',
        type: 'DISTRIBUTOR_RM',
      };
    } else {
      createdBy = {
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        type: 'ADMIN',
      };
    }

    return {
      ...coupon,
      redemptionType,
      mapToMarketing,
      isUsed: isRedeemed,
      redemptionCount,
      orders,
      stats: {
        totalRedemptions: paidOrders.length,
        allOrdersCount: orders.length,
        uniqueUsersCount: uniqueUsersMap.size,
        uniqueUsers: Array.from(uniqueUsersMap.values()),
        totalSharesSold,
        totalGrossRevenue,
        totalDiscountDisbursed,
        totalNetSales,
        avgSharesPerOrder: paidOrders.length > 0 ? Math.round(totalSharesSold / paidOrders.length) : 0,
        avgOrderValue: paidOrders.length > 0 ? Math.round(totalNetSales / paidOrders.length) : 0,
      },
      relationshipManager,
      createdBy,
      isDirectAdmin,
    };
  }

  /**
   * Retrieves all coupons created by a specific RM.
   */
  async getCouponsForRM(internalRmId: string | null, distributorRmId: string | null) {
    const whereClause: any = {};
    if (internalRmId && distributorRmId && internalRmId === distributorRmId) {
       whereClause.OR = [{ internalRmId }, { distributorRmId }];
    } else if (internalRmId) {
       whereClause.internalRmId = internalRmId;
    } else if (distributorRmId) {
       whereClause.distributorRmId = distributorRmId;
    }

    const isExternal = !!distributorRmId;
    const coupons = await this.prisma.coupon.findMany({
      where: whereClause,
      select: {
        id: true,
        code: true,
        stockId: true,
        stock: {
          select: {
            name: true,
            price: true,
            minimumPurchaseQuantity: true,
            maximumPurchaseQuantity: true,
            internalLendingPrice: true,
            externalLendingPrice: true,
          },
        },
        minQuantity: true,
        maxQuantity: true,
        discountAmount: true,
        discountType: true,
        discountPercentage: true,
        lendingPrice: true,
        isUsed: true,
        usedAt: true,
        usedByUser: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            quantity: true,
            pricePerShare: true,
            totalAmount: true,
            originalTotalAmount: true,
            discountApplied: true,
            revenueSharePercentage: true,
            incentivePercentage: true,
            lendingPrice: true,
            status: true,
            createdAt: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Handle coupons where order was linked via Order.couponId instead of Coupon.orderId
    const unlinkedCouponIds = coupons.filter((c: any) => c.isUsed && !c.order).map((c: any) => c.id);
    const fallbackOrdersMap = new Map<string, any>();
    if (unlinkedCouponIds.length > 0) {
      const fallbackOrders = await this.prisma.order.findMany({
        where: { couponId: { in: unlinkedCouponIds } },
        select: {
          id: true,
          couponId: true,
          orderNumber: true,
          quantity: true,
          pricePerShare: true,
          totalAmount: true,
          originalTotalAmount: true,
          discountApplied: true,
          revenueSharePercentage: true,
          incentivePercentage: true,
          lendingPrice: true,
          status: true,
          createdAt: true,
        },
      });
      for (const o of fallbackOrders) {
        if (o.couponId && !fallbackOrdersMap.has(o.couponId)) {
          fallbackOrdersMap.set(o.couponId, o);
        }
      }
    }

    return coupons.map((c) => {
      const resolvedOrder = c.order || fallbackOrdersMap.get(c.id) || null;
      const snapshottedLp = resolvedOrder?.lendingPrice ?? (c as any).lendingPrice ?? (isExternal ? c.stock?.externalLendingPrice : c.stock?.internalLendingPrice) ?? null;
      return {
        id: c.id,
        code: c.code,
        stockId: c.stockId,
        lendingPrice: snapshottedLp,
        stock: c.stock
          ? {
              name: c.stock.name,
              price: c.stock.price,
              minimumPurchaseQuantity: c.stock.minimumPurchaseQuantity,
              maximumPurchaseQuantity: c.stock.maximumPurchaseQuantity,
              lendingPrice: snapshottedLp ?? (isExternal ? c.stock.externalLendingPrice : c.stock.internalLendingPrice),
              internalLendingPrice: resolvedOrder?.lendingPrice ?? (c as any).lendingPrice ?? c.stock.internalLendingPrice,
              externalLendingPrice: resolvedOrder?.lendingPrice ?? (c as any).lendingPrice ?? c.stock.externalLendingPrice,
            }
          : null,
        minQuantity: c.minQuantity,
        maxQuantity: c.maxQuantity,
        discountAmount: c.discountAmount,
        discountType: c.discountType,
        discountPercentage: c.discountPercentage,
        isUsed: c.isUsed,
        usedAt: c.usedAt,
        usedByUser: (c as any).usedByUser,
        order: resolvedOrder,
        createdAt: c.createdAt,
      };
    });
  }

  /**
   * Retrieves all coupons (for Admin analytics or Admin promotions).
   * When adminOnly is true, strictly returns only coupons created by an Admin (verified via AuditLog).
   * When marketingOnly is true, strictly returns only coupons mapped to the marketing panel.
   */
  async getAllCoupons(adminOnly = false, marketingOnly = false) {
    // Query CREATE audit logs for coupons to identify which admin created each coupon
    const couponAuditLogs = await this.prisma.auditLog.findMany({
      where: { entity: 'COUPON', action: 'CREATE' },
      orderBy: { timestamp: 'desc' },
    });

    const auditMap = new Map<string, any>();
    const adminCreatedCouponIds = new Set<string>();
    const adminCreatedCodes = new Set<string>();

    for (const log of couponAuditLogs) {
      if (log.entityId) {
        if (!auditMap.has(log.entityId)) {
          auditMap.set(log.entityId, log);
        }
        adminCreatedCouponIds.add(log.entityId);
      }
      const metaCode = (log.metadata as any)?.code || (log.changes as any)?.code;
      if (metaCode) {
        if (!auditMap.has(metaCode)) {
          auditMap.set(metaCode, log);
        }
        adminCreatedCodes.add(metaCode);
      }
    }

    // If admin promotions are requested, ONLY return coupons that were actually created by an admin
    if (adminOnly && adminCreatedCouponIds.size === 0 && adminCreatedCodes.size === 0) {
      return [];
    }

    const whereClause: any = {};
    if (adminOnly) {
      whereClause.internalRmId = null;
      whereClause.distributorRmId = null;
      whereClause.OR = [
        { id: { in: Array.from(adminCreatedCouponIds) } },
        { code: { in: Array.from(adminCreatedCodes) } },
      ];
    }

    const coupons = await this.prisma.coupon.findMany({
      where: whereClause,
      include: { 
        stock: true, 
        assignedUser: true, 
        usedByUser: true,
        order: true,
        internalRm: {
          include: {
            branch: true,
          },
        },
        distributorRm: {
          include: {
            distributor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const couponIds = coupons.map((c) => c.id);

    // Fetch all orders associated with these coupons to support multi-user admin coupon analytics
    const allLinkedOrders = await this.prisma.order.findMany({
      where: { couponId: { in: couponIds } },
      include: {
        user: true,
        stock: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const ordersMap = new Map<string, any[]>();
    for (const o of allLinkedOrders) {
      if (o.couponId) {
        if (!ordersMap.has(o.couponId)) {
          ordersMap.set(o.couponId, []);
        }
        ordersMap.get(o.couponId)!.push(o);
      }
    }

    const adminIds = Array.from(new Set(couponAuditLogs.map((l) => l.adminId).filter((id) => id && id !== 'unknown')));
    const admins = adminIds.length > 0
      ? await this.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true, email: true, role: true },
        })
      : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    const mappedList = coupons.map((c) => {
      const rmId = c.distributorRmId || c.internalRmId || null;
      const distributorId = c.distributorRm?.distributorId || null;
      const branchId = c.internalRm?.branchId || null;
      const rmName = c.distributorRm?.name || c.internalRm?.name || null;
      const rmEmail = c.distributorRm?.email || c.internalRm?.email || null;

      const isExternal = !!c.distributorRmId;
      const isDirectAdmin = !c.internalRmId && !c.distributorRmId;

      const ordersForThisCoupon = ordersMap.get(c.id) || [];
      const paidOrders = ordersForThisCoupon.filter((o) =>
        ['PAID', 'ALLOCATED', 'COMPLETED'].includes(o.status)
      );

      const audit = auditMap.get(c.id) || auditMap.get(c.code);
      const redemptionType: 'ONCE' | 'UNLIMITED' =
        (audit?.metadata as any)?.redemptionType ||
        (audit?.changes as any)?.redemptionType ||
        (isDirectAdmin ? 'UNLIMITED' : 'ONCE');

      const mapToMarketing: boolean =
        (audit?.metadata as any)?.mapToMarketing ??
        (audit?.changes as any)?.mapToMarketing ??
        false;

      const isRedeemed = isDirectAdmin
        ? (redemptionType === 'ONCE' ? (paidOrders.length > 0 || c.isUsed) : false)
        : c.isUsed;
      const redemptionCount = isDirectAdmin ? paidOrders.length : (c.isUsed ? 1 : 0);

      const rawOrder = (c as any).order || (ordersForThisCoupon.length > 0 ? ordersForThisCoupon[0] : null);
      const resolvedOrder = rawOrder
        ? {
            ...rawOrder,
            orderId: rawOrder.orderNumber || rawOrder.id,
            orderNumber: rawOrder.orderNumber || rawOrder.id,
            quantity: rawOrder.quantity ?? 0,
            pricePerShare: rawOrder.pricePerShare ?? 0,
            totalAmount: rawOrder.totalAmount ?? 0,
          }
        : null;

      const relationshipManager = c.distributorRm
        ? {
            id: c.distributorRm.id,
            name: c.distributorRm.name,
            email: c.distributorRm.email,
            distributorId: c.distributorRm.distributorId,
            distributor: c.distributorRm.distributor || (c.distributorRm.distributorId ? {
              id: c.distributorRm.distributorId,
              name: 'Distributor',
              email: '',
            } : null),
          }
        : c.internalRm
        ? {
            id: c.internalRm.id,
            name: c.internalRm.name,
            email: c.internalRm.email,
            branchId: c.internalRm.branchId,
            branch: c.internalRm.branch || (c.internalRm.branchId ? {
              id: c.internalRm.branchId,
              name: 'Branch',
              email: '',
            } : null),
          }
        : null;

      let createdBy: {
        id?: string;
        name: string;
        email?: string;
        role: string;
        type: 'ADMIN' | 'RM' | 'DISTRIBUTOR_RM';
        createdAt?: string;
      } | null = null;

      if (isDirectAdmin) {
        if (audit) {
          const admin = adminMap.get(audit.adminId);
          const name = admin?.fullName || (audit.metadata as any)?.adminName || audit.adminEmail?.split('@')[0] || 'Super Admin';
          const role = admin?.role || audit.adminRole || 'SUPER_ADMIN';
          createdBy = {
            id: audit.adminId,
            name,
            email: admin?.email || audit.adminEmail,
            role,
            type: 'ADMIN',
            createdAt: audit.timestamp?.toISOString(),
          };
        } else {
          createdBy = null;
        }
      } else if (c.internalRm) {
        createdBy = {
          id: c.internalRm.id,
          name: c.internalRm.name,
          email: c.internalRm.email,
          role: 'BRANCH_RM',
          type: 'RM',
        };
      } else if (c.distributorRm) {
        createdBy = {
          id: c.distributorRm.id,
          name: c.distributorRm.name,
          email: c.distributorRm.email,
          role: 'DISTRIBUTOR_RM',
          type: 'DISTRIBUTOR_RM',
        };
      } else {
        createdBy = {
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          type: 'ADMIN',
        };
      }

      return {
        ...c,
        redemptionType,
        mapToMarketing,
        isUsed: isRedeemed,
        redemptionCount,
        orders: ordersForThisCoupon,
        order: resolvedOrder,
        rmId,
        distributorId,
        branchId,
        rmName,
        rmEmail,
        relationshipManager,
        createdBy,
      };
    });

    if (marketingOnly) {
      return mappedList.filter((c) => c.mapToMarketing === true);
    }

    return mappedList;
  }

  /**
   * Retrieves coupon statistics for an RM dashboard.
   */
  async getCouponStatsForRM(internalRmId: string | null, distributorRmId: string | null) {
    const whereClause: any = {};
    if (internalRmId && distributorRmId && internalRmId === distributorRmId) {
       whereClause.OR = [{ internalRmId }, { distributorRmId }];
    } else if (internalRmId) {
       whereClause.internalRmId = internalRmId;
    } else if (distributorRmId) {
       whereClause.distributorRmId = distributorRmId;
    }

    const totalCoupons = await this.prisma.coupon.count({
      where: whereClause,
    });

    const usedCoupons = await this.prisma.coupon.count({
      where: { ...whereClause, isUsed: true },
    });

    const availableCoupons = await this.prisma.coupon.count({
      where: { 
        ...whereClause,
        isUsed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
    });

    return {
      totalCoupons,
      usedCoupons,
      availableCoupons,
    };
  }

  /**
   * Computes sales stats for an RM's Sales page:
   * - totalTransactions: count of used coupons
   * - totalRevenue: sum of order.totalAmount across used coupons
   * - yourShare: (sellingPrice - lendingPrice) * quantity * revenueSharePercentage / 100
   * - revenueSharePercentage: the EXTERNAL percentage from RevenueShareSetting
   */
  async getSalesStatsForRM(internalRmId: string | null, distributorRmId: string | null) {
    const whereClause: any = {};
    if (internalRmId && distributorRmId && internalRmId === distributorRmId) {
       whereClause.OR = [{ internalRmId }, { distributorRmId }];
    } else if (internalRmId) {
       whereClause.internalRmId = internalRmId;
    } else if (distributorRmId) {
       whereClause.distributorRmId = distributorRmId;
    }

    // 1. Determine if this RM is internal (no distributor) or external
    const isExternal = !!distributorRmId;
    const settingType = isExternal ? 'EXTERNAL' : 'INTERNAL';

    // 2. Fetch revenue share percentage
    const revenueSetting = await this.prisma.revenueShareSetting.findUnique({
      where: { type: settingType },
    });
    const revenueSharePercentage = revenueSetting?.revenuePercentage ?? 0;

    // 3. Fetch all used coupons for this RM with order + stock data
    const usedCoupons = await this.prisma.coupon.findMany({
      where: { ...whereClause, isUsed: true },
      include: {
        order: {
          select: {
            quantity: true,
            totalAmount: true,
            pricePerShare: true,
            originalTotalAmount: true,
            discountApplied: true,
            lendingPrice: true,
          },
        },
        stock: {
          select: { price: true, externalLendingPrice: true, internalLendingPrice: true },
        },
      },
    });

    const unlinkedUsedCouponIds = usedCoupons.filter((c) => !c.order).map((c) => c.id);
    const fallbackOrdersMap = new Map<string, any>();
    if (unlinkedUsedCouponIds.length > 0) {
      const fallbackOrders = await this.prisma.order.findMany({
        where: { couponId: { in: unlinkedUsedCouponIds } },
        select: {
          id: true,
          couponId: true,
          quantity: true,
          totalAmount: true,
          pricePerShare: true,
          originalTotalAmount: true,
          discountApplied: true,
          lendingPrice: true,
        },
      });
      for (const o of fallbackOrders) {
        if (o.couponId && !fallbackOrdersMap.has(o.couponId)) {
          fallbackOrdersMap.set(o.couponId, o);
        }
      }
    }

    // 4. Compute stats
    let totalTransactions = 0;
    let totalRevenue = 0;
    let totalMargin = 0;

    for (const coupon of usedCoupons) {
      const order = coupon.order || fallbackOrdersMap.get(coupon.id);
      if (!order) continue;

      const qty = order.quantity || 0;
      if (qty <= 0) continue;

      totalTransactions++;

      const sellingPrice = order.pricePerShare ?? coupon.stock?.price ?? 0;
      let discountPerShare = 0;
      if (order.discountApplied && qty > 0) {
        discountPerShare = order.discountApplied / qty;
      } else if (coupon.discountType === 'PERCENTAGE' && coupon.discountPercentage) {
        discountPerShare = (sellingPrice * coupon.discountPercentage) / 100;
      } else {
        discountPerShare = coupon.discountAmount || 0;
      }

      const discountedPrice = (qty > 0 && order.totalAmount)
        ? order.totalAmount / qty
        : Math.max(0, sellingPrice - discountPerShare);

      const lendingPrice = (order as any).lendingPrice ?? (coupon as any).lendingPrice ?? (isExternal
        ? (coupon.stock?.externalLendingPrice ?? 0)
        : (coupon.stock?.internalLendingPrice ?? 0));

      const revenuePerShare = Math.max(0, discountedPrice - lendingPrice);
      const saleMargin = revenuePerShare * qty;

      totalMargin += saleMargin;
      totalRevenue += saleMargin;
    }

    const yourShare = totalMargin * (revenueSharePercentage / 100);

    return {
      totalTransactions,
      totalRevenue: Math.round(totalMargin * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      yourShare: Math.round(yourShare * 100) / 100,
      revenueSharePercentage: revenueSharePercentage,
      incentivePercentage: revenueSetting?.incentivePercentage || 0,
      isExternal,
    };
  }
}
