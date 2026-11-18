import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';

/**
 * Marketing statistics for admin dashboard
 * Includes lead counts, conversion metrics, and campaign performance
 */
export interface MarketingAdminStats {
  /** Total number of marketing leads */
  totalLeads: number;

  /**
   * Number of converted leads.
   * A lead counts as converted when its linked user has at least one order
   * with paymentStatus = 'PAID' — the same definition the marketing panel
   * dashboard uses. (The legacy `status = 'CONVERTED'` flag is never set by
   * any flow, so counting it kept this metric permanently at 0.)
   */
  convertedLeads: number;

  /** Lead conversion rate as percentage (0-100) */
  conversionRate: number;

  /** Lead counts grouped by source/platform, sorted by count desc */
  leadsBySource: Array<{
    source: string;
    count: number;
 }>;

  /**
   * Top 5 real campaigns ranked by conversions (leads with ≥1 PAID order).
   * The auto-created 'System Database Sync' pseudo-campaign (platform SYSTEM)
   * is excluded — it only holds synced app users, not campaign performance.
   */
  topCampaigns: Array<{
    id: string;
    name: string;
    platform: string;
    leadCount: number;
    /** Leads in this campaign with ≥1 PAID order */
    conversions: number;
 }>;
}

/** KYC funnel stage for marketing leads */
export type KycStage = 'NOT_INITIATED' | 'PENDING' | 'NOT_VERIFIED' | 'VERIFIED';

/** Last payment status for marketing leads (NA while KYC not initiated) */
export type LastPaymentStatus = 'NA' | 'PENDING' | 'PAID' | 'NO_TRANSACTION';

/** eSign stage for marketing leads/dropped rows (null = esign never initiated) */
export type EsignStage = 'COMPLETED' | 'NOT_COMPLETED';

export interface LeadAnalytics {
  id: string;
  clientId: string;
  name: string;
  kycStatus: string;
  /** 4-stage KYC funnel: NOT_INITIATED | PENDING | NOT_VERIFIED | VERIFIED */
  kycStage: KycStage;
  /** Masked phone (e.g. ******1712), null when unknown */
  phoneMasked: string | null;
  /** Renamed Payment Status: NA (KYC not initiated) | PENDING | PAID */
  lastPaymentStatus: LastPaymentStatus;
  /** eSign stage of the most recent order: COMPLETED (SIGNED) | NOT_COMPLETED (docId present, not SIGNED) | null (never initiated) */
  esignStage: EsignStage | null;
  /** Lead acquisition source (FACEBOOK, GOOGLE, IMPORTED, ...) */
  source: string | null;
  /** Linked campaign id/name */
  campaignId: string | null;
  campaignName: string | null;
  /** Count of ALL orders (paid + pending) */
  totalTransactionCount: number;
  /** Value of ALL orders (paid + pending) */
  totalTransactionValue: number;
  /** Count of SUCCESSFUL transactions only (paymentStatus === 'PAID') */
  transactionCount: number;
  /** Value of SUCCESSFUL transactions only (paymentStatus === 'PAID') */
  transactionValue: number;
  /** Shares from SUCCESSFUL transactions only (paymentStatus === 'PAID') */
  sharesRequested: number;
  /** Name of the last SUCCESSFUL (PAID) order's share/basket, null when none */
  lastShareName: string | null;
  /** Share names the user asked to be notified about (Notify Me / StockInterest) */
  requestedShareNames: string[];
  /** Most-recent activity across lead + linked user/orders (excludes logins) */
  lastActivityAt: Date;
  /** Last transaction date/time if lead has transacted */
  lastTransactionAt?: Date | string | null;
}

export interface LeadTransactionSource {
  /** SMC (our organisation) | Distributor */
  source: 'SMC' | 'Distributor';
  /** Branch name for SMC coupon orders, distributor name for distributor orders */
  sourceDetails: string | null;
}

export interface LeadDetailTransaction {
  date: Date | null;
  shareName: string | null;
  quantity: number | null;
  revenue: number | null;
  source: 'SMC' | 'Distributor' | null;
  sourceDetails: string | null;
}

export interface LeadDetail {
  clientId: string;
  clientName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  createdOn: Date | null;
  lastLoginAt: Date | null;
  kycCompletedOn: Date | null;
  firstTransaction: LeadDetailTransaction;
  lastTransaction: LeadDetailTransaction;
  totalTransactionsCompleted: number;
  totalRevenue: number;
  totalTransactionsFailed: number;
  allTransactionsAttempted: number;
  branchRevenue: number;
  branchTransactions: number;
  distributorRevenue: number;
  distributorTransactions: number;
}

/** Mask an email as ch***@gmail.com (null-safe) */
export function maskEmail(email?: string | null): string | null {
  if (!email || !email.includes('@')) return email ?? null;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Mask a phone keeping last 4 digits (e.g. ******1712, null-safe) */
export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '******' + digits;
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Resolve the 4-stage KYC funnel for a user.
 * NOT_INITIATED = no kycData at all; PENDING = started but not submitted;
 * NOT_VERIFIED = submitted, awaiting admin verification; VERIFIED = verified.
 */
export function resolveKycStage(user?: { kycStatus?: string | null; kycData?: unknown } | null): KycStage {
  if (!user) return 'NOT_INITIATED';
  if (String(user.kycStatus || 'PENDING').toUpperCase() === 'VERIFIED') return 'VERIFIED';
  const kycData = (user.kycData ?? null) as Record<string, any> | null;
  if (!kycData) return 'NOT_INITIATED';
  if ((kycData as Record<string, any>).submittedAt) return 'NOT_VERIFIED';
  return 'PENDING';
}

/**
 * KYC stage for leads WITHOUT a matched user, derived from imported/manual
 * metadata (Add Lead / CSV import). Accepts canonical stage names as well as
 * legacy user statuses (VERIFIED/PENDING/REJECTED).
 */
export function stageFromMetadataStatus(value?: unknown): KycStage {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'VERIFIED') return 'VERIFIED';
  if (normalized === 'PENDING') return 'PENDING';
  if (normalized === 'NOT_VERIFIED' || normalized === 'REJECTED') return 'NOT_VERIFIED';
  return 'NOT_INITIATED';
}

/**
 * Requested share names for leads WITHOUT a matched user. Accepts an array
 * or a comma-separated string (as produced by CSV import / Add Lead).
 */
export function requestedNamesFromMetadata(value?: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
 }
  if (typeof value === 'string') {
    return value.split(',').map(v => v.trim()).filter(Boolean);
 }
  return [];
}

/** Display name of an order's share/basket */
export function orderShareName(order?: { stock?: { name?: string | null } | null; basket?: { name?: string | null } | null } | null): string | null {
  return order?.stock?.name || order?.basket?.name || null;
}

/**
 * Derive transaction source from the order's coupon.
 * Coupon via InternalRM => SMC + branch name; via DistributorRM => Distributor + name;
 * no coupon => SMC Direct.
 */
export function resolveOrderSource(order?: {
  coupon?: {
    internalRm?: { name?: string | null; branch?: { name?: string | null } | null } | null;
    distributorRm?: { name?: string | null; distributor?: { name?: string | null } | null } | null;
 } | null;
} | null): LeadTransactionSource {
  const coupon = order?.coupon;
  if (coupon?.distributorRm) {
    return {
      source: 'Distributor',
      sourceDetails: coupon.distributorRm.distributor?.name || coupon.distributorRm.name || null,
   };
 }
  if (coupon?.internalRm) {
    return {
      source: 'SMC',
      sourceDetails: coupon.internalRm.branch?.name || coupon.internalRm.name || null,
   };
 }
  return { source: 'SMC', sourceDetails: 'SMC Direct' };
}

/**
 * Computes a user's authentic latest activity timestamp across all real events:
 * 1. Orders & Transactions (completed payments, pending checkout attempts, dropped checkouts)
 * 2. KYC steps, submissions, verifications, rejections
 * 3. Demat & Bank verification/submissions
 * 4. Stock interests (Notify Me)
 * 5. eSign attempts (initiated / signed / cancelled / mismatch)
 * 6. Registration / Account Creation
 * 
 * STRICTLY EXCLUDES: bulk sync timestamps, lead.updatedAt, and user.updatedAt.
 */
export function computeUserAuthenticActivityTime(
  userRecord: any,
  leadRecord: any,
  orders: any[] = userRecord?.orders || [],
  stockInterests: any[] = userRecord?.stockInterests || [],
  esignAttempts: any[] = [],
): { recencyKey: number; lastTransactionTime: number; createdTime: number } {
  const toTime = (v: unknown): number => {
    if (!v) return 0;
    const t = new Date(v as any).getTime();
    return Number.isNaN(t) ? 0 : t;
 };

  const metadata = (leadRecord?.metadata as Record<string, any>) || {};

  // 1. Orders & Transactions (Paid, Pending, Failed, Cancelled, Dropped Checkouts)
  const orderTimes: number[] = orders.map((o: any) =>
    Math.max(toTime(o.updatedAt), toTime(o.createdAt)),
  ).filter(t => t > 0);

  const metadataTxnTime = metadata.lastTransactionDate ? toTime(metadata.lastTransactionDate) : 0;
  const lastTransactionTime = Math.max(...orderTimes, metadataTxnTime, 0);

  // 2. KYC Form, Progress, Submissions & Verifications
  const kycData = (userRecord?.kycData ?? null) as Record<string, any> | null;
  const kycTimes: number[] = [
    toTime(kycData?.submittedAt),
    toTime(kycData?.approvedAt),
    toTime(kycData?.rejectedAt),
    toTime(kycData?.lastUpdatedAt),
    toTime(kycData?.lastUpdatedStep),
    toTime(kycData?.panDetails?.verifiedAt),
    toTime(kycData?.aadhaarDetails?.verifiedAt),
    toTime(kycData?.bankDetails?.verifiedAt),
    toTime(kycData?.createdAt),
    toTime(kycData?.updatedAt),
  ].filter(t => t > 0);

  // 3. Demat & Bank verification
  const dematData = (userRecord?.dematData ?? null) as Record<string, any> | null;
  const bankData = (userRecord?.bankData ?? null) as Record<string, any> | null;
  const dematDocs = (userRecord?.dematDocuments ?? null) as Record<string, any> | null;
  const dematBankTimes: number[] = [
    toTime(dematData?.submittedAt),
    toTime(dematData?.lastUpdatedAt),
    toTime(dematDocs?.dematStatement?.uploadedAt),
    toTime(bankData?.submittedAt),
    toTime(bankData?.lastUpdatedAt),
    toTime(userRecord?.lastBankVerificationAttempt),
    ...(Array.isArray(userRecord?.successfulBankVerifications)
      ? userRecord.successfulBankVerifications.map(toTime)
      : []),
  ].filter(t => t > 0);

  // 4. Stock Interests (Notify Me requests)
  const interestTimes: number[] = stockInterests.map((si: any) =>
    Math.max(toTime(si.updatedAt), toTime(si.createdAt)),
  ).filter(t => t > 0);

  // 4b. eSign attempts (initiated / signed / cancelled / mismatch) — so a
  // Dropped-at-esign state change resurfaces the lead like KYC/payment do.
  const esignTimes: number[] = esignAttempts.map((a: any) =>
    Math.max(toTime(a.updatedAt), toTime(a.createdAt)),
  ).filter(t => t > 0);

  // 5. Account Registration / Lead Creation
  const registrationTime =
    toTime(userRecord?.createdAt) ||
    toTime(leadRecord?.createdAt) ||
    toTime(metadata?.createdAt) ||
    0;

  // Real Authentic Events ONLY (DO NOT include bulk sync lastActivityAt or system updatedAt)
  const allRealEventTimes = [
    ...orderTimes,
    metadataTxnTime,
    ...kycTimes,
    ...dematBankTimes,
    ...interestTimes,
    ...esignTimes,
    registrationTime,
  ].filter(t => t > 0);

  const recencyKey = allRealEventTimes.length > 0
    ? Math.max(...allRealEventTimes)
    : (toTime(leadRecord?.createdAt) || Date.now());

  return {
    recencyKey,
    lastTransactionTime,
    createdTime: registrationTime,
 };
}

export interface LeadAnalyticsResponse {
  data: LeadAnalytics[];
  summary: {
    totalUsers: number;
    usersInitiatedKyc: number;
    usersCompletedKyc: number;
    usersTransacted: number;
    totalTransactions: number;
    totalTransactionValue: number;
    avgTransactionCountPerUser: number;
    avgTransactionValuePerUser: number;
 };
  /** Distinct acquisition sources in the DB (powers Source dropdowns) */
  sources: string[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
 };
}

/**
 * Marketing Service
 * Handles business logic for marketing campaigns and leads management
 */
@Injectable()
export class MarketingService implements OnModuleInit {
  private readonly logger = new PinoNestLogger('stocks-service', '');
  private leadSyncInFlight = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Automatically reconcile all leads' lastActivityAt in the background after startup
    setTimeout(() => {
      void this.reconcileAllLeadTimestamps().catch((err) => {
        this.logger.log('⚠️ Marketing - Startup lead reconciliation failed:', err);
     });
   }, 3000);
 }

  // ===============================
  // CAMPAIGN METHODS
  // ===============================

  /**
   * Get all marketing campaigns
   * @returns Array of campaigns with lead counts
   */
  async getAllCampaigns() {
    this.logger.log('📊 Marketing - Getting all campaigns');

    const campaigns = await this.prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true },
       },
     },
   });

    this.logger.log(' Marketing - Retrieved campaigns count:', campaigns.length);
    return campaigns;
 }

  /**
   * Get campaign by ID
   * @param id - Campaign ID
   * @returns Campaign with lead count
   */
  async getCampaignById(id: string) {
    this.logger.log('📊 Marketing - Getting campaign by ID:', id);

    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leads: true },
       },
     },
   });

    if (!campaign) {
      this.logger.log('❌ Marketing - Campaign not found:', id);
      throw new NotFoundException('Campaign not found');
   }

    this.logger.log(' Marketing - Campaign retrieved:', campaign.name);
    return campaign;
 }

  /**
   * Create a new marketing campaign
   * @param createData - Campaign creation data
   * @returns Created campaign
   */
  async createCampaign(createData: CreateCampaignDto) {
    this.logger.log('📊 Marketing - Creating campaign:', createData.name);

    const campaign = await this.prisma.marketingCampaign.create({
      data: createData,
   });

    this.logger.log(' Marketing - Campaign created:', campaign.id);
    return campaign;
 }

  /**
   * Update an existing campaign
   * @param id - Campaign ID
   * @param updateData - Campaign update data
   * @returns Updated campaign
   */
  async updateCampaign(id: string, updateData: Partial<CreateCampaignDto>) {
    this.logger.log('📊 Marketing - Updating campaign:', id);

    // Check if campaign exists
    const existingCampaign = await this.prisma.marketingCampaign.findUnique({
      where: { id },
   });

    if (!existingCampaign) {
      this.logger.log('❌ Marketing - Campaign not found for update:', id);
      throw new NotFoundException('Campaign not found');
   }

    const campaign = await this.prisma.marketingCampaign.update({
      where: { id },
      data: updateData,
   });

    this.logger.log(' Marketing - Campaign updated:', campaign.id);
    return campaign;
 }

  /**
   * Delete a campaign
   * @param id - Campaign ID
   */
  async deleteCampaign(id: string) {
    this.logger.log('📊 Marketing - Deleting campaign:', id);

    // Check if campaign exists
    const existingCampaign = await this.prisma.marketingCampaign.findUnique({
      where: { id },
   });

    if (!existingCampaign) {
      this.logger.log('❌ Marketing - Campaign not found for deletion:', id);
      throw new NotFoundException('Campaign not found');
   }

    // Delete associated leads first to prevent foreign key constraint violations
    await this.prisma.marketingLead.deleteMany({
      where: { campaignId: id },
   });

    await this.prisma.marketingCampaign.delete({
      where: { id },
   });

    this.logger.log(' Marketing - Campaign deleted:', id);
 }

  // ===============================
  // LEAD METHODS
  // ===============================

  /**
   * Get all marketing leads with filtering and pagination
   * @param filters - Filter criteria
   * @returns Leads with pagination info
   */
  async getAllLeads(filters: LeadFilterDto, user?: { adminId: string; role: string }) {
    this.logger.log('📊 Marketing - Getting all leads with filters:', filters);

    // Build where clause
    const where: any = {};

    // Force Sales Employee to only see their own assigned leads, overriding any filters
    const userRole = user?.role as string;
    this.logger.log(`[Marketing] getAllLeads called by user ${user?.adminId} with role: ${userRole}`);
    
    if (userRole === 'SALES_EMPLOYEE' || userRole === 'Sales Employee') {
      this.logger.log(`[DEBUG] Applying SALES_EMPLOYEE filter. adminId: ${user?.adminId}`);
      if (!user?.adminId) {
        this.logger.error('[DEBUG] FATAL ERROR: Sales Employee has no adminId! Denying access to all leads.');
        where.assignedToId = 'INVALID_ID_TO_PREVENT_LEAKAGE';
     } else {
        where.assignedToId = user.adminId;
     }
   } else if (filters?.assignedToId) {
      // AssignedTo filter (only apply if not a Sales Employee)
      where.assignedToId = filters.assignedToId;
   }

    // Date range filter
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
     }
      if (filters.endDate) {
        // Set end date to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
     }
   }

    // Status filter
    if (filters?.status) {
      where.status = filters.status;
   }

    // Source filter
    if (filters?.source) {
      where.source = filters.source;
   }

    // Campaign filter
    if (filters?.campaignId) {
      where.campaignId = filters.campaignId;
   }



    // Search filter (name, email or phone)
    if (filters?.search) {
      const searchText = filters.search;
      // Phone numbers may be typed with spaces, dashes or country codes
      // (e.g. "+91 90136 21712") while stored as plain digits, so also match
      // digit-only and last-10-digit variants.
      const searchDigits = searchText.replace(/\D/g, '');
      const phoneVariants = new Set<string>([searchText]);
      if (searchDigits) {
        phoneVariants.add(searchDigits);
        if (searchDigits.length > 10) {
          phoneVariants.add(searchDigits.slice(-10));
       }
     }
      where.OR = [
        {
          fullName: {
            contains: searchText,
            mode: 'insensitive',
         },
       },
        {
          email: {
            contains: searchText,
            mode: 'insensitive',
         },
       },
        ...Array.from(phoneVariants).map((variant) => ({
          phone: { contains: variant },
       })),
      ];
   }

    // Last-activity range filter (Date/Time filter mechanism for recently-updated-first view)
    if (filters?.lastActivityFrom || filters?.lastActivityTo) {
      (where as any).lastActivityAt = {};
      if (filters.lastActivityFrom) {
        (where as any).lastActivityAt.gte = new Date(filters.lastActivityFrom);
     }
      if (filters.lastActivityTo) {
        const endDate = new Date(filters.lastActivityTo);
        endDate.setHours(23, 59, 59, 999);
        (where as any).lastActivityAt.lte = endDate;
     }
   }

    // Build order by — default: most-recently-updated first.
    // `id` is always the final tiebreaker: bulk-synced rows share identical
    // timestamps, and without one Postgres returns tied rows in
    // nondeterministic order (shuffled table on every refresh).
    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'lastActivityAt',
      'fullName',
      'status',
    ]);
    const sortBy =
      filters?.sortBy && allowedSortFields.has(filters.sortBy)
        ? filters.sortBy
        : 'lastActivityAt';
    const sortOrder = filters?.sortOrder || 'desc';
    const orderBy: any =
      sortBy === 'lastActivityAt'
        ? [{ lastActivityAt: sortOrder }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ [sortBy]: sortOrder }, { id: 'desc' }];

    // Calculate pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [leads, totalCount] = await Promise.all([
      this.prisma.marketingLead.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              platform: true,
              status: true,
           },
         },
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
           },
         },
       },
        orderBy,
        skip,
        take: limit,
     }),
      this.prisma.marketingLead.count({ where }),
    ]);

    this.logger.log(
      ' Marketing - Retrieved leads count:',
      leads.length,
      'of',
      totalCount,
    );

    return {
      data: leads,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
     },
   };
 }

  /**
   * Get leads analytics with enriched user/transaction data
   * @param filters - Filter criteria
   * @returns Leads analytics with pagination and summary stats
   */
  async getLeadsAnalytics(filters: LeadFilterDto, user?: { adminId: string; role: string }): Promise<LeadAnalyticsResponse> {
    this.logger.log('📊 Marketing - Getting leads analytics');
    const { data: leads, pagination } = await this.getAllLeads(filters, user);

    // Fetch related users for these leads based on convertedToUserId, email, or phone.
    // NOTE: User.email / User.phone are encrypted (random IV ciphertext), so only
    // exact-match filters are rewritten by the field-encryption extension into
    // hash lookups. `{ in: [...] }` / `contains` against ciphertext NEVER match —
    // that is why rows showed NA while the popup (exact-match findFirst) was right.
    const leadUserIds = leads.map(l => l.convertedToUserId).filter(Boolean) as string[];

    const userInclude = {
      orders: {
        select: {
          id: true,
          totalAmount: true,
          quantity: true,
          paymentStatus: true,
          status: true,
          esignDocId: true,
          esignStatus: true,
          createdAt: true,
          updatedAt: true,
          stock: { select: { name: true } },
          basket: { select: { name: true } },
       }
     },
      stockInterests: {
        include: {
          stock: { select: { name: true } },
       }
     }
   } as const;

    // 1. Bulk match by convertedToUserId (plain id field — `in` works here).
    const usersById = leadUserIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: leadUserIds } },
          include: { ...userInclude },
       })
      : [];
    const users: typeof usersById = [...usersById];
    const knownUserIds = new Set(users.map(u => u.id));

    // 2. Exact-match fallback per unmatched lead — same query shape as
    // getLeadDetail (proven to hit via emailHash/phoneHash rewrite).
    const needsFallback = leads.filter(lead =>
      !(lead.convertedToUserId && knownUserIds.has(lead.convertedToUserId)) &&
      (lead.email || lead.phone)
    );
    if (needsFallback.length > 0) {
      const fallbackUsers = await Promise.all(
        needsFallback.map(lead => {
          const orConditions: any[] = [];
          if (lead.email) orConditions.push({ email: lead.email });
          if (lead.phone) orConditions.push({ phone: lead.phone });
          return this.prisma.user.findFirst({
            where: { OR: orConditions },
            include: { ...userInclude },
         });
       })
      );
      for (const user of fallbackUsers) {
        if (user && !knownUserIds.has(user.id)) {
          knownUserIds.add(user.id);
          users.push(user);
       }
     }
   }

    let usersInitiatedKyc = 0;
    let usersCompletedKyc = 0;
    let usersTransacted = 0;
    let totalTransactions = 0;
    let totalTransactionValue = 0;

    // Latest e-sign attempt per matched user (covers sign-first abandons that
    // have no Order row). Also feeds recency so an esign state change
    // resurfaces the lead like KYC/payment changes do. Best-effort: never
    // blocks the leads query.
    const esignAttemptsByUser = new Map<string, Array<{ status: string; createdAt: Date; updatedAt: Date }>>();
    const latestAttemptByUser = new Map<string, { status: string; createdAt: Date }>();
    try {
      const userIds = [...knownUserIds];
      if (userIds.length > 0) {
        const attempts = await (this.prisma as any).esignAttempt.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, status: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: 'desc' },
       });
        for (const a of attempts) {
          const list = esignAttemptsByUser.get(a.userId) || [];
          list.push({ status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt });
          esignAttemptsByUser.set(a.userId, list);
          if (!latestAttemptByUser.has(a.userId)) {
            latestAttemptByUser.set(a.userId, { status: a.status, createdAt: a.createdAt });
         }
       }
     }
   } catch (err: any) {
      this.logger.log('📊 Marketing - esign attempt lookup skipped:', err?.message);
   }

    const enrichedWithRecency: Array<{
      row: LeadAnalytics;
      recencyKey: number;
      liveActivity: Date;
      lastTransactionTime: number;
      createdTime: number;
   }> = leads.map(lead => {
      // Find matching user (reads are decrypted, so in-memory compare works)
      const matchedUser = users.find(u =>
        (lead.convertedToUserId && u.id === lead.convertedToUserId) ||
        (lead.email && u.email === lead.email) ||
        (lead.phone && u.phone === lead.phone)
      );

      const metadata = (lead.metadata as Record<string, any>) || {};

      // Authentic user event activity:
      // Orders (paid, pending, dropped checkouts) + KYC + Demat + Bank + Stock Interests + eSign attempts + Registration
      // STRICTLY excludes bulk sync timestamps and system updatedAt
      const orders = matchedUser?.orders || [];
      const stockInterests = (matchedUser as any)?.stockInterests || [];
      const userEsignAttempts = matchedUser ? (esignAttemptsByUser.get(matchedUser.id) || []) : [];
      const { recencyKey, lastTransactionTime, createdTime } = computeUserAuthenticActivityTime(
        matchedUser,
        lead,
        orders,
        stockInterests,
        userEsignAttempts,
      );
      const liveActivity = new Date(recencyKey);
      const lastTransactionAt = lastTransactionTime > 0 ? new Date(lastTransactionTime).toISOString() : null;

      const clientId = metadata.clientId || matchedUser?.id || lead.id;
      const name = lead.fullName || matchedUser?.fullName || 'Unknown';
      const kycStatus = String(metadata.kycStatus || matchedUser?.kycStatus || 'PENDING').toUpperCase();
      
      // Only SUCCESSFUL transactions count: paymentStatus === 'PAID'.
      // Dropped checkouts (PENDING/PROCESSING/FAILED/CANCELLED/EXPIRED) must be excluded.
      const successfulOrders = orders.filter((o) => o.paymentStatus === 'PAID');
      // Latest-order-wins for status flags: the most recent checkout attempt
      // decides PAID vs PENDING (an old PAID + a new dropped PROCESSING must
      // read as PENDING — payment for the latest attempt was not received).
      const latestOrder = [...orders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      const isLatestPaid = !!latestOrder && (
        latestOrder.paymentStatus === 'PAID' ||
        (latestOrder as any).paymentStatus === 'SUCCESS' ||
        (latestOrder as any).status === 'PAID' ||
        (latestOrder as any).status === 'COMPLETED'
      );
      // eSign stage (payment flags above untouched). Whichever is fresher wins:
      // the latest order's doc, or the latest standalone attempt (sign-first
      // abandons have no Order row); neither -> null (renders '—').
      const latestEsignStatus = String((latestOrder as any)?.esignStatus || '').toUpperCase();
      const latestEsignDocId = (latestOrder as any)?.esignDocId || null;
      const latestAttempt = matchedUser ? latestAttemptByUser.get(matchedUser.id) : undefined;
      const orderTime = latestOrder ? new Date((latestOrder as any).createdAt).getTime() : 0;
      const attemptTime = latestAttempt ? new Date(latestAttempt.createdAt).getTime() : 0;
      let esignStage: EsignStage | null = null;
      if (matchedUser) {
        if (latestAttempt && attemptTime > orderTime) {
          esignStage = latestAttempt.status === 'SIGNED' ? 'COMPLETED' : 'NOT_COMPLETED';
       } else if (latestEsignStatus === 'SIGNED') {
          esignStage = 'COMPLETED';
       } else if (latestEsignDocId) {
          esignStage = 'NOT_COMPLETED';
       } else if (latestAttempt) {
          esignStage = latestAttempt.status === 'SIGNED' ? 'COMPLETED' : 'NOT_COMPLETED';
       }
     }
      // Totals cover ALL orders (paid + pending); unmatched leads fall back to
      // imported/manual metadata (Add Lead / CSV import).
      const leadTotalTransactionCount = matchedUser
        ? orders.length
        : (metadata.totalTransactionCount !== undefined ? Number(metadata.totalTransactionCount) || 0 : 0);
      const leadTotalTransactionValue = matchedUser
        ? orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
        : (metadata.totalTransactionValue !== undefined ? Number(metadata.totalTransactionValue) || 0 : 0);
      const transactionCount = matchedUser
        ? successfulOrders.length
        : (metadata.transactionCount !== undefined ? Number(metadata.transactionCount) || 0 : 0);
      const transactionValue = matchedUser
        ? successfulOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
        : (metadata.transactionValue !== undefined ? Number(metadata.transactionValue) || 0 : 0);
      const sharesRequested = matchedUser
        ? successfulOrders.reduce((sum, order) => sum + (order.quantity || 0), 0)
        : (metadata.sharesRequested !== undefined ? Number(metadata.sharesRequested) || 0 : 0);
      const paymentStatus = String(metadata.paymentStatus || (isLatestPaid ? 'PAID' : (latestOrder?.paymentStatus || 'PENDING'))).toUpperCase();

      // Matched users always win (live data); otherwise honor imported/manual metadata.
      const kycStage = matchedUser
        ? resolveKycStage({ kycStatus: matchedUser.kycStatus, kycData: (matchedUser as Record<string, any>).kycData ?? null })
        : stageFromMetadataStatus(metadata.kycStatus);
      const rawPhone = matchedUser?.phone || lead.phone || null;
      const metadataPayment = String(metadata.paymentStatus || '').trim().toUpperCase();
      const lastPaymentStatus: LastPaymentStatus =
        kycStage === 'NOT_INITIATED'
          ? 'NA'
          : leadTotalTransactionCount === 0
            // No orders at all (neither paid nor pending) — must not read
            // as money in flight, so it gets its own state instead of Pending.
            ? 'NO_TRANSACTION'
            : matchedUser
              ? (isLatestPaid ? 'PAID' : 'PENDING')
              : (metadataPayment === 'PAID' || metadataPayment === 'PENDING' || metadataPayment === 'NA'
                  ? (metadataPayment as LastPaymentStatus)
                  : 'PENDING');
      const lastShareName = matchedUser
        ? (successfulOrders.length > 0
            ? orderShareName([...successfulOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).at(-1))
            : null)
        : (metadata.lastShareName ? String(metadata.lastShareName) : null);
      const requestedShareNames = matchedUser
        ? ((matchedUser as Record<string, any>).stockInterests || [])
            .map((si: any) => si?.stock?.name)
            .filter((n: any): n is string => typeof n === 'string' && n.length > 0)
        : requestedNamesFromMetadata(metadata.requestedShareNames);

      // Update aggregate stats
      if (kycStatus === 'VERIFIED') {
        usersCompletedKyc++;
        usersInitiatedKyc++;
     } else if (kycStatus !== 'PENDING' || matchedUser?.kycData != null) {
        usersInitiatedKyc++;
     }

      if (transactionCount > 0) {
        usersTransacted++;
        totalTransactions += transactionCount;
        totalTransactionValue += transactionValue;
     }

      return {
        row: {
          id: lead.id,
          clientId,
          name,
          kycStatus,
          kycStage,
          phoneMasked: maskPhone(rawPhone),
          lastPaymentStatus,
          esignStage,
          source: (lead as any).source || null,
          campaignId: (lead as any).campaignId || null,
          campaignName: (lead as any).campaign?.name || null,
          totalTransactionCount: leadTotalTransactionCount,
          totalTransactionValue: leadTotalTransactionValue,
          status: lead.status,
          transactionCount,
          transactionValue,
          sharesRequested,
          lastShareName,
          requestedShareNames,
          paymentStatus,
          lastActivityAt: liveActivity,
          lastTransactionAt,
       },
        recencyKey,
        liveActivity,
        lastTransactionTime,
        createdTime,
     };
   });

    // Arrange date-wise based on latest activity (newest activity at the very top, just like vouchers in accounting panel).
    // ANY activity — recent KYC, order created/dropped payment, payment success, profile update, or signup —
    // brings the lead to the top based on the latest activity timestamp.
    enrichedWithRecency.sort(
      (a, b) =>
        b.recencyKey - a.recencyKey ||
        b.lastTransactionTime - a.lastTransactionTime ||
        b.createdTime - a.createdTime ||
        (b.row.id > a.row.id ? 1 : b.row.id < a.row.id ? -1 : 0),
    );
    const enrichedLeads: LeadAnalytics[] = enrichedWithRecency.map(e => e.row);

    // Converge persisted order for future DB-level sorts/pagination:
    // backfill rows whose stored lastActivityAt lags behind live activity.
    void Promise.allSettled(
      enrichedWithRecency
        .filter(e => {
          const stored = (leads.find(l => l.id === e.row.id) as any)
            ?.lastActivityAt;
          const storedMs = stored ? new Date(stored).getTime() : 0;
          return (
            !Number.isNaN(e.recencyKey) &&
            e.recencyKey > 0 &&
            (Number.isNaN(storedMs) || Math.abs(e.recencyKey - storedMs) > 1000)
          );
       })
        .map(e =>
          this.prisma.marketingLead.update({
            where: { id: e.row.id },
            data: { lastActivityAt: e.liveActivity } as any,
         }),
        ),
    ).catch(() => undefined);

    const summary = {
      totalUsers: enrichedLeads.length,
      usersInitiatedKyc,
      usersCompletedKyc,
      usersTransacted,
      totalTransactions,
      totalTransactionValue,
      avgTransactionCountPerUser: usersTransacted > 0 ? totalTransactions / usersTransacted : 0,
      avgTransactionValuePerUser: usersTransacted > 0 ? totalTransactionValue / usersTransacted : 0,
   };

    return {
      data: enrichedLeads,
      summary,
      sources: await this.getDistinctLeadSources(),
      pagination
   };
 }

  /**
   * Distinct lead acquisition sources (powers the Source filter dropdown —
   * includes SYSTEM/IMPORTED rows that a hardcoded platform list would miss).
   */
  private async getDistinctLeadSources(): Promise<string[]> {
    try {
      const rows = await this.prisma.marketingLead.findMany({
        select: { source: true },
        distinct: ['source'],
     });
      return rows
        .map((r) => r.source)
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .sort();
   } catch {
      return [];
   }
 }

  /**
   * Get full detail for a single lead (opened from the leads table name popup).
   * First/Last transactions consider SUCCESSFUL (PAID) orders only.
   * Transaction source is derived from the order coupon:
   * InternalRM coupon => SMC + branch name; DistributorRM coupon => Distributor + name;
   * no coupon => SMC Direct.
   */
  async getLeadDetail(leadId: string): Promise<LeadDetail> {
    this.logger.log('📊 Marketing - Getting lead detail:', leadId);

    const lead = await this.prisma.marketingLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
   }

    const orConditions: any[] = [];
    if (lead.convertedToUserId) orConditions.push({ id: lead.convertedToUserId });
    if (lead.email) orConditions.push({ email: lead.email });
    if (lead.phone) orConditions.push({ phone: lead.phone });

    const user = orConditions.length > 0
      ? await this.prisma.user.findFirst({
          where: { OR: orConditions },
          include: {
            orders: {
              orderBy: { createdAt: 'asc' },
              include: {
                stock: { select: { name: true } },
                basket: { select: { name: true } },
                coupon: {
                  select: {
                    internalRm: { select: { name: true, branch: { select: { name: true } } } },
                    distributorRm: { select: { name: true, distributor: { select: { name: true } } } },
                 },
               },
             },
           },
         },
       })
      : null;

    const metadata = (lead.metadata as Record<string, any>) || {};
    const clientId = metadata.clientId || user?.id || lead.id;
    const clientName = lead.fullName || user?.fullName || 'Unknown';
    const rawEmail = user?.email || lead.email || null;
    const rawPhone = user?.phone || lead.phone || null;

    const kycData = (user as Record<string, any> | null)?.kycData as Record<string, any> | null | undefined;
    const kycCompletedOn = kycData?.submittedAt ? new Date(kycData.submittedAt) : null;

    const emptyTxn: LeadDetailTransaction = {
      date: null, shareName: null, quantity: null, revenue: null, source: null, sourceDetails: null,
   };

    const orders = user?.orders || [];
    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
    const failedOrders = orders.filter((o) => o.paymentStatus !== 'PAID');

    const toDetailTxn = (order: (typeof orders)[number] | undefined): LeadDetailTransaction => {
      if (!order) return { ...emptyTxn };
      const { source, sourceDetails } = resolveOrderSource(order as any);
      return {
        date: order.createdAt,
        shareName: orderShareName(order as any),
        quantity: order.quantity ?? null,
        revenue: order.totalAmount ?? null,
        source,
        sourceDetails,
     };
   };

    const firstTransaction = toDetailTxn(paidOrders[0]);
    const lastTransaction = toDetailTxn(paidOrders[paidOrders.length - 1]);

    let branchRevenue = 0;
    let branchTransactions = 0;
    let distributorRevenue = 0;
    let distributorTransactions = 0;
    for (const order of paidOrders) {
      const { source } = resolveOrderSource(order as any);
      if (source === 'Distributor') {
        distributorTransactions++;
        distributorRevenue += order.totalAmount || 0;
     } else {
        branchTransactions++;
        branchRevenue += order.totalAmount || 0;
     }
   }

    return {
      clientId,
      clientName,
      maskedEmail: maskEmail(rawEmail),
      maskedPhone: maskPhone(rawPhone),
      createdOn: user?.createdAt || lead.createdAt || null,
      lastLoginAt: (user as Record<string, any> | null)?.lastLoginAt || null,
      kycCompletedOn,
      firstTransaction,
      lastTransaction,
      totalTransactionsCompleted: paidOrders.length,
      totalRevenue: paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      totalTransactionsFailed: failedOrders.length,
      allTransactionsAttempted: orders.length,
      branchRevenue,
      branchTransactions,
      distributorRevenue,
      distributorTransactions,
   };
 }

  /**
   * Get dropped checkouts (users who initiated checkout but dropped before completing payment)
   */
  async getDroppedCheckouts(filters?: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
 }) {
    this.logger.log('🛒 Marketing - Getting dropped checkouts with filters:', filters);

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));
    const skip = (page - 1) * limit;

    const baseDroppedCondition = {
      OR: [
        { paymentStatus: { in: ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED', 'EXPIRED'] } },
        { status: { in: ['PENDING', 'CANCELLED', 'FAILED'] } }
      ]
   };

    const where: any = {
      ...baseDroppedCondition,
   };

    // Explicit status filter override if provided and not 'ALL'
    if (filters?.status && filters.status !== 'ALL') {
      where.paymentStatus = filters.status;
   }

    // Filter by date range
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
   }

    // Search filter
    if (filters?.search && filters.search.trim()) {
      const query = filters.search.trim();
      const matchedUserIds = await this.findUserIdsBySearch(query);
      where.AND = [
        {
          OR: [
            // user.email / user.phone are encrypted — match via decrypted user IDs
            ...(matchedUserIds.length > 0 ? [{ userId: { in: matchedUserIds } }] : []),
            { stock: { name: { contains: query, mode: 'insensitive' } } },
            { stock: { isin: { contains: query, mode: 'insensitive' } } },
          ]
       }
      ];
   }

    const [totalCount, orders, allDroppedOrders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              kycStatus: true,
           }
         },
          stock: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              isin: true,
              price: true,
           }
         },
          basket: {
            select: {
              id: true,
              name: true,
              slug: true,
              iconUrl: true,
           }
         }
       }
     }),
      // Aggregate summary metrics across all dropped orders
      this.prisma.order.findMany({
        where: baseDroppedCondition,
        select: {
          totalAmount: true,
          userId: true,
       }
     })
    ]);

    const totalDroppedValue = allDroppedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const uniqueUsersSet = new Set(allDroppedOrders.map(o => o.userId).filter(Boolean));
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      data: orders.map(order => {
        const rowEsignStatus = String((order as any).esignStatus || '').toUpperCase();
        const rowEsignDocId = (order as any).esignDocId || null;
        return {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        userName: order.user?.fullName || 'Guest / Unnamed User',
        userEmail: order.user?.email || '',
        userPhone: order.user?.phone || '',
        userKycStatus: order.user?.kycStatus || 'PENDING',
        stockId: order.stockId,
        stockName: order.stock?.name || order.basket?.name || 'Stock Purchase',
        stockLogoUrl: order.stock?.logoUrl || order.basket?.iconUrl || null,
        stockIsin: order.stock?.isin || '',
        quantity: order.quantity,
        pricePerShare: order.pricePerShare,
        totalAmount: order.totalAmount,
        discountApplied: order.discountApplied || 0,
        status: order.status,
        paymentStatus: order.paymentStatus || 'PENDING',
        esignDocId: rowEsignDocId,
        esignStatus: (order as any).esignStatus || 'PENDING',
        esignStage: rowEsignStatus === 'SIGNED' ? 'COMPLETED' as const : rowEsignDocId ? 'NOT_COMPLETED' as const : null,
        cashfreeOrderId: order.cashfreeOrderId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
       };
     }),
      summary: {
        totalDroppedCount: allDroppedOrders.length,
        totalDroppedValue,
        uniqueUsersCount: uniqueUsersSet.size,
        avgDroppedValue: allDroppedOrders.length > 0 ? totalDroppedValue / allDroppedOrders.length : 0,
     },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
     }
   };
 }

  /**
   * Resolve user IDs matching a free-text search on name, email or phone.
   * `User.email` / `User.phone` are encrypted at rest (prisma-field-encryption),
   * so SQL `contains` cannot match them. We load the minimal user projection
   * (decrypted by the Prisma extension on read) and match in memory.
   */
  private async findUserIdsBySearch(query: string): Promise<string[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qDigits = q.replace(/\D/g, '');
    const users = await this.prisma.user.findMany({
      select: { id: true, fullName: true, email: true, phone: true },
   });
    return users
      .filter((u) => {
        if ((u.fullName || '').toLowerCase().includes(q)) return true;
        if ((u.email || '').toLowerCase().includes(q)) return true;
        const phoneDigits = (u.phone || '').replace(/\D/g, '');
        return qDigits.length >= 3 && phoneDigits.includes(qDigits);
     })
      .map((u) => u.id);
 }

  /**
   * Get e-sign dropouts (users who initiated a Digitap session but never signed).
   * First-class EsignAttempt rows — includes sign-first abandons that have no
   * Order row at all. SIGNED attempts are excluded by default.
   */
  async getEsignDropouts(filters?: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
 }) {
    this.logger.log('✍️ Marketing - Getting e-sign dropouts with filters:', filters);

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));
    const skip = (page - 1) * limit;

    const DROPOUT_STATUSES = ['INITIATED', 'CANCELLED', 'MISMATCH', 'FAILED', 'EXPIRED'];

    const where: any = {};
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
   } else {
      where.status = { in: DROPOUT_STATUSES };
   }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
   }

    if (filters?.search && filters.search.trim()) {
      const query = filters.search.trim();
      const matchedUserIds = await this.findUserIdsBySearch(query);
      where.AND = [
        {
          OR: [
            // user.email / user.phone are encrypted — match via decrypted user IDs
            ...(matchedUserIds.length > 0 ? [{ userId: { in: matchedUserIds } }] : []),
            { stockName: { contains: query, mode: 'insensitive' } },
            { docId: { contains: query, mode: 'insensitive' } },
          ],
       },
      ];
   }

    const prisma: any = this.prisma as any;
    const [totalCount, attempts, allDropouts, signedCount] = await Promise.all([
      prisma.esignAttempt.count({ where }),
      prisma.esignAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true, kycStatus: true },
         },
       },
     }),
      prisma.esignAttempt.findMany({
        where: { status: { in: DROPOUT_STATUSES } },
        select: { totalAmount: true, userId: true },
     }),
      prisma.esignAttempt.count({ where: { status: 'SIGNED' } }),
    ]);

    // Resolve stock/basket logos for the page (attempts store ids + snapshot name)
    const stockIds = [...new Set(attempts.map((a: any) => a.stockId).filter(Boolean))] as string[];
    const basketIds = [...new Set(attempts.map((a: any) => a.basketId).filter(Boolean))] as string[];
    const [stocks, baskets] = await Promise.all([
      stockIds.length > 0
        ? this.prisma.stock.findMany({ where: { id: { in: stockIds } }, select: { id: true, logoUrl: true, isin: true } })
        : [],
      basketIds.length > 0
        ? (this.prisma as any).stockBasket.findMany({ where: { id: { in: basketIds } }, select: { id: true, iconUrl: true } })
        : [],
    ]);
    const stockById = new Map<string, any>((stocks as any[]).map((s: any) => [s.id, s] as [string, any]));
    const basketById = new Map<string, any>((baskets as any[]).map((b: any) => [b.id, b] as [string, any]));

    const totalDropoutValue = allDropouts.reduce((sum: number, a: any) => sum + (a.totalAmount || 0), 0);
    const uniqueUsersSet = new Set(allDropouts.map((a: any) => a.userId).filter(Boolean));
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      data: attempts.map((a: any) => {
        const stock = a.stockId ? stockById.get(a.stockId) : null;
        const basket = a.basketId ? basketById.get(a.basketId) : null;
        return {
          id: a.id,
          docId: a.docId,
          userId: a.userId,
          userName: a.user?.fullName || 'Guest / Unnamed User',
          userEmail: a.user?.email || '',
          userPhone: a.user?.phone || '',
          userKycStatus: a.user?.kycStatus || 'PENDING',
          stockId: a.stockId,
          basketId: a.basketId,
          stockName: a.stockName || 'Stock Purchase',
          stockLogoUrl: stock?.logoUrl || basket?.iconUrl || null,
          stockIsin: stock?.isin || '',
          quantity: a.quantity,
          pricePerShare: a.pricePerShare,
          totalAmount: a.totalAmount,
          esignStatus: a.status,
          esignStage: a.status === 'SIGNED' ? 'COMPLETED' : 'NOT_COMPLETED',
          orderId: a.orderId,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
       };
     }),
      summary: {
        totalEsignDropouts: allDropouts.length,
        totalDropoutValue,
        uniqueUsersCount: uniqueUsersSet.size,
        signedCount,
        avgDropoutValue: allDropouts.length > 0 ? totalDropoutValue / allDropouts.length : 0,
     },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
     },
   };
 }

  /**
   * Get top stocks based on various metrics
   * @param sortBy - The metric to sort by
   */
  async getTopStocks(sortBy: 'transactionCount' | 'transactionValue' | 'userRequested' | 'userWatchlisted' = 'transactionCount') {
    this.logger.log('📊 Marketing - Getting top stocks by:', sortBy);
    
    const stocks = await this.prisma.stock.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
        orders: { select: { id: true, totalAmount: true } },
        watchlistedBy: { select: { id: true } },
        interests: { select: { id: true } }
     }
   });

    const enrichedStocks = stocks.map(stock => {
      const transactionCount = stock.orders.length;
      const transactionValue = stock.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const userWatchlisted = stock.watchlistedBy.length;
      const userRequested = stock.interests.length;

      let metricValue = 0;
      if (sortBy === 'transactionCount') metricValue = transactionCount;
      if (sortBy === 'transactionValue') metricValue = transactionValue;
      if (sortBy === 'userRequested') metricValue = userRequested;
      if (sortBy === 'userWatchlisted') metricValue = userWatchlisted;

      return {
        id: stock.id,
        name: stock.name,
        logoUrl: stock.logoUrl,
        metricValue
     };
   });

    enrichedStocks.sort((a, b) => b.metricValue - a.metricValue);
    
    // Add rank
    const rankedStocks = enrichedStocks.slice(0, 50).map((s, index) => ({
      ...s,
      rank: index + 1
   }));

    return { stocks: rankedStocks };
 }

  /**
   * Get lead by ID
   * @param id - Lead ID
   * @returns Lead with relations
   */
  async getLeadById(id: string) {
    this.logger.log('📊 Marketing - Getting lead by ID:', id);

    const lead = await this.prisma.marketingLead.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            platform: true,
            status: true,
         },
       },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
     },
   });

    if (!lead) {
      this.logger.log('❌ Marketing - Lead not found:', id);
      throw new NotFoundException('Lead not found');
   }

    this.logger.log(' Marketing - Lead retrieved:', lead.fullName || lead.email);
    return lead;
 }

  /**
   * Create a new marketing lead
   * @param createData - Lead creation data
   * @returns Created lead
   */
  async createLead(createData: CreateLeadDto) {
    this.logger.log(
      '📊 Marketing - Creating lead for campaign:',
      createData.campaignId,
    );

    // Validate campaign exists
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: createData.campaignId },
   });

    if (!campaign) {
      this.logger.log('❌ Marketing - Campaign not found:', createData.campaignId);
      throw new NotFoundException('Campaign not found');
   }

    const lead = await this.prisma.marketingLead.create({
      data: { ...createData, lastActivityAt: new Date() } as any,
   });

    this.logger.log(' Marketing - Lead created:', lead.id);
    return lead;
 }

  /**
   * Update an existing lead
   * @param id - Lead ID
   * @param updateData - Lead update data
   * @returns Updated lead
   */
  async updateLead(id: string, updateData: UpdateLeadDto) {
    this.logger.log('📊 Marketing - Updating lead:', id);

    // Check if lead exists
    const existingLead = await this.prisma.marketingLead.findUnique({
      where: { id },
   });

    if (!existingLead) {
      this.logger.log('❌ Marketing - Lead not found for update:', id);
      throw new NotFoundException('Lead not found');
   }

    const lead = await this.prisma.marketingLead.update({
      where: { id },
      data: { ...updateData, lastActivityAt: new Date() } as any,
   });

    this.logger.log(' Marketing - Lead updated:', lead.id);
    return lead;
 }

  /**
   * Bump persisted lastActivityAt for every lead linked to a platform user.
   * Linked by convertedToUserId/email/phone. Excludes logins by design —
   * callers decide which user/order events count as activity.
   */
  async touchLeadsByUserId(
    userId: string,
    at: Date = new Date(),
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true },
     });
      if (!user) return;
      const or: any[] = [{ convertedToUserId: user.id }];
      // email/phone are encrypted — exact-match only (same rewrite as analytics fallback)
      if ((user as any).email) or.push({ email: (user as any).email });
      if ((user as any).phone) or.push({ phone: (user as any).phone });
      await this.prisma.marketingLead.updateMany({
        where: { OR: or },
        data: { lastActivityAt: at } as any,
     });
   } catch (error) {
      this.logger.log(' Marketing - touchLeadsByUserId skipped:', error);
   }
 }

  /**
   * Get panel users eligible for lead assignment
   */
  async getMarketingPanelUsers() {
    this.logger.log('📊 Marketing - Getting marketing panel users');
    return this.prisma.admin.findMany({
      where: {
        role: { in: ['MARKETING_MANAGER', 'SALES_EMPLOYEE'] },
        isActive: true,
     },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
     },
   });
 }

  /**
   * Assign lead to a user
   */
  async assignLeadToUser(leadId: string, userId: string) {
    this.logger.log(`📊 Marketing - Assigning lead ${leadId} to user ${userId}`);

    const existingLead = await this.prisma.marketingLead.findUnique({
      where: { id: leadId },
   });

    if (!existingLead) {
      throw new NotFoundException('Lead not found');
   }

    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
   });

    if (!admin || !['MARKETING_MANAGER', 'SALES_EMPLOYEE'].includes(admin.role)) {
      throw new NotFoundException('User not found or invalid role');
   }

    await this.prisma.marketingLead.update({
      where: { id: leadId },
      data: { assignedToId: userId, lastActivityAt: new Date() } as any,
   });

    this.logger.log('✅ Marketing - Lead assigned successfully');
 }

  /**
   * Assign multiple leads to a user
   * @param leadIds - Array of lead IDs
   * @param userId - Admin ID to assign to
   */
  async bulkAssignLeads(leadIds: string[], userId: string) {
    this.logger.log(`📊 Marketing - Bulk assigning ${leadIds.length} leads to user ${userId}`);

    const admin = await this.prisma.admin.findUnique({
      where: { id: userId },
   });

    if (!admin || !['MARKETING_MANAGER', 'SALES_EMPLOYEE'].includes(admin.role)) {
      throw new NotFoundException('User not found or invalid role');
   }

    await this.prisma.marketingLead.updateMany({
      where: { id: { in: leadIds } },
      data: { assignedToId: userId, lastActivityAt: new Date() } as any,
   });

    this.logger.log('✅ Marketing - Leads bulk assigned successfully');
 }

  /**
   * Update lead status
   * @param leadId - Lead ID
   * @param status - New status
   */
  async updateLeadStatus(leadId: string, status: string) {
    this.logger.log('📊 Marketing - Updating lead status:', leadId, '->', status);

    // Check if lead exists
    const existingLead = await this.prisma.marketingLead.findUnique({
      where: { id: leadId },
   });

    if (!existingLead) {
      this.logger.log('❌ Marketing - Lead not found for status update:', leadId);
      throw new NotFoundException('Lead not found');
   }

    await this.prisma.marketingLead.update({
      where: { id: leadId },
      data: { status, lastActivityAt: new Date() } as any,
   });

    this.logger.log(' Marketing - Lead status updated');
 }

  /**
   * Reconciles persisted lastActivityAt for all marketing leads against authentic user events
   * (orders, KYC, demat, bank, stock interests, registration).
   * Runs in safe batches to avoid overwhelming Postgres.
   */
  async reconcileAllLeadTimestamps(users?: any[], existingLeads?: any[]): Promise<number> {
    try {
      const allUsers = users || await this.prisma.user.findMany({
        include: {
          orders: {
            select: {
              id: true,
              totalAmount: true,
              quantity: true,
              paymentStatus: true,
              status: true,
              createdAt: true,
              updatedAt: true,
           },
         },
          stockInterests: {
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
           },
         },
       },
     });

      const allLeads = existingLeads || await this.prisma.marketingLead.findMany({
        select: {
          id: true,
          email: true,
          phone: true,
          convertedToUserId: true,
          createdAt: true,
          metadata: true,
          lastActivityAt: true,
       },
     });

      const updates: Promise<any>[] = [];
      for (const lead of allLeads) {
        const matchedUser = allUsers.find((u: any) =>
          (lead.convertedToUserId && u.id === lead.convertedToUserId) ||
          (lead.email && u.email === lead.email) ||
          (lead.phone && u.phone === lead.phone),
        );
        const { recencyKey } = computeUserAuthenticActivityTime(
          matchedUser,
          lead,
          matchedUser?.orders || [],
          matchedUser?.stockInterests || [],
        );
        const storedMs = lead.lastActivityAt ? new Date(lead.lastActivityAt).getTime() : 0;
        if (!Number.isNaN(recencyKey) && recencyKey > 0 && Math.abs(recencyKey - storedMs) > 1000) {
          updates.push(
            this.prisma.marketingLead.update({
              where: { id: lead.id },
              data: { lastActivityAt: new Date(recencyKey) } as any,
           }),
          );
       }
     }

      if (updates.length > 0) {
        const batchSize = 25;
        for (let i = 0; i < updates.length; i += batchSize) {
          await Promise.allSettled(updates.slice(i, i + batchSize));
       }
        this.logger.log(`✓ Marketing - Reconciled ${updates.length} leads with authentic activity timestamps`);
     }
      return updates.length;
   } catch (err) {
      this.logger.log('⚠️ Marketing - Failed to reconcile lead timestamps:', err);
      return 0;
   }
 }

  /**
   * Auto-sync database users into marketing leads on a schedule.
   * Runs even when nobody has the marketing panel open — the frontend
   * table polling then picks up new leads automatically.
   *
   * Config via env (no redeploy of frontend needed):
   * - MARKETING_LEAD_SYNC_CRON: cron expression, default every 2 minutes
   * - MARKETING_LEAD_SYNC_ENABLED: set to 'false' to disable
   */
  @Cron(process.env.MARKETING_LEAD_SYNC_CRON || '*/2 * * * *')
  async autoSyncDatabaseUsersToLeads() {
    if (process.env.MARKETING_LEAD_SYNC_ENABLED === 'false') return;
    if (this.leadSyncInFlight) {
      this.logger.warn('Lead auto-sync skipped: previous run still in flight');
      return;
   }
    this.leadSyncInFlight = true;
    try {
      const result = await this.syncDatabaseUsersToLeads();
      if (result.count > 0) {
        this.logger.log(`Lead auto-sync: synced ${result.count} new users to leads`);
     }
   } catch (err: any) {
      this.logger.error(`Lead auto-sync failed: ${err?.message}`);
   } finally {
      this.leadSyncInFlight = false;
   }
 }

  /**
   * Syncs existing User records to MarketingLead table with authentic event timestamps
   */
  async syncDatabaseUsersToLeads() {
    this.logger.log('🔄 Marketing - Syncing database users to leads and reconciling activity');

    // 1. Ensure System Campaign exists
    let systemCampaign = await this.prisma.marketingCampaign.findFirst({
      where: { name: 'System Database Sync' }
   });

    if (!systemCampaign) {
      systemCampaign = await this.prisma.marketingCampaign.create({
        data: {
          name: 'System Database Sync',
          platform: 'SYSTEM',
          status: 'ACTIVE',
          budget: 0
       }
     });
   }

    // 2. Get all Users with orders and stockInterests
    const users = await this.prisma.user.findMany({
      include: {
        orders: {
          select: {
            id: true,
            totalAmount: true,
            quantity: true,
            paymentStatus: true,
            status: true,
            createdAt: true,
            updatedAt: true,
         },
       },
        stockInterests: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
         },
       },
     },
   });

    // 3. Get all existing leads to check for duplicates
    const existingLeads = await this.prisma.marketingLead.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        convertedToUserId: true,
        createdAt: true,
        metadata: true,
        lastActivityAt: true,
     },
   });

    const existingEmails = new Set(existingLeads.map(l => l.email).filter(Boolean));
    const existingPhones = new Set(existingLeads.map(l => l.phone).filter(Boolean));
    const existingUserIds = new Set(existingLeads.map(l => l.convertedToUserId).filter(Boolean));

    // 4. Filter users who are not leads yet
    const newLeadsToInsert: any[] = [];
    for (const user of users) {
      if ((user.email && existingEmails.has(user.email)) || 
          (user.phone && existingPhones.has(user.phone)) ||
          (existingUserIds.has(user.id))) {
        continue;
     }
      
      const { recencyKey } = computeUserAuthenticActivityTime(
        user,
        null,
        user.orders || [],
        user.stockInterests || [],
      );

      newLeadsToInsert.push({
        campaignId: systemCampaign.id,
        fullName: user.fullName || 'Unknown User',
        email: user.email,
        phone: user.phone,
        status: 'NEW',
        source: 'SYSTEM',
        convertedToUserId: user.id,
        createdAt: user.createdAt,
        lastActivityAt: new Date(recencyKey),
     });
   }

    // 5. Bulk insert
    let count = 0;
    if (newLeadsToInsert.length > 0) {
      const result = await this.prisma.marketingLead.createMany({
        data: newLeadsToInsert,
        skipDuplicates: true
     });
      count = result.count;
   }

    // 6. Reconcile existing leads' lastActivityAt so historical dummy sync dates are wiped clean
    const reconciledCount = await this.reconcileAllLeadTimestamps(users, existingLeads);

    return {
      success: true,
      count,
      message: `Successfully synced ${count} new users and reconciled ${reconciledCount} lead timestamps.`
   };
 }

  /**
   * Get marketing statistics for admin dashboard
   *
   * Conversion uses the same definition as the marketing panel dashboard:
   * a lead is converted when its linked user has at least one order with
   * paymentStatus = 'PAID' (matched via convertedToUserId, email or phone).
   * The legacy `status = 'CONVERTED'` flag is never set by any flow.
   *
   * @returns Marketing analytics data
   */
  async getMarketingStatsForAdmin(): Promise<MarketingAdminStats> {
    this.logger.log('📊 Marketing - Calculating admin stats');

    // Leads + users with successful transactions + campaigns in parallel.
    // Email/phone reads are decrypted by the field-encryption extension, so
    // in-memory matching below works (same approach as getLeadsAnalytics).
    const [leads, paidUsers, campaigns] = await Promise.all([
      this.prisma.marketingLead.findMany({
        select: {
          id: true,
          email: true,
          phone: true,
          convertedToUserId: true,
          source: true,
          campaignId: true,
       },
     }),
      this.prisma.user.findMany({
        where: { orders: { some: { paymentStatus: 'PAID' } } },
        select: { id: true, email: true, phone: true },
     }),
      this.prisma.marketingCampaign.findMany({
        select: { id: true, name: true, platform: true },
     }),
    ]);

    const totalLeads = leads.length;

    // Lookup sets for users with ≥1 PAID order
    const paidIds = new Set(paidUsers.map((u) => u.id));
    const paidEmails = new Set(
      paidUsers.map((u) => u.email).filter(Boolean) as string[],
    );
    const paidPhones = new Set(
      paidUsers.map((u) => u.phone).filter(Boolean) as string[],
    );

    const isConverted = (lead: {
      convertedToUserId: string | null;
      email: string | null;
      phone: string | null;
   }) =>
      (!!lead.convertedToUserId && paidIds.has(lead.convertedToUserId)) ||
      (!!lead.email && paidEmails.has(lead.email)) ||
      (!!lead.phone && paidPhones.has(lead.phone));

    const convertedLeadIds = new Set(
      leads.filter(isConverted).map((l) => l.id),
    );
    const convertedLeads = convertedLeadIds.size;

    // Calculate conversion rate
    const conversionRate =
      totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    // Leads by source, sorted by count desc so [0] is the true top source
    // (groupBy without orderBy returned rows in arbitrary order).
    const sourceCounts = new Map<string, number>();
    for (const lead of leads) {
      const source =
        lead.source && lead.source.trim() ? lead.source : 'Unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
   }
    const leadsBySource = [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Rank real campaigns by conversions (not raw lead count, which the
    // auto-created 'System Database Sync' pseudo-campaign always wins).
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));
    const perCampaign = new Map<string, { leadCount: number; conversions: number }>();
    for (const lead of leads) {
      if (!lead.campaignId) continue;
      const entry = perCampaign.get(lead.campaignId) || {
        leadCount: 0,
        conversions: 0,
     };
      entry.leadCount += 1;
      if (convertedLeadIds.has(lead.id)) entry.conversions += 1;
      perCampaign.set(lead.campaignId, entry);
   }
    const topCampaigns = [...perCampaign.entries()]
      .map(([campaignId, stats]) => {
        const campaign = campaignById.get(campaignId);
        return {
          id: campaignId,
          name: campaign?.name || 'Unknown Campaign',
          platform: campaign?.platform || '',
          leadCount: stats.leadCount,
          conversions: stats.conversions,
          // SYSTEM pseudo-campaigns sort last regardless of volume
          isSystem: (campaign?.platform || '').toUpperCase() === 'SYSTEM',
       };
     })
      .sort(
        (a, b) =>
          Number(a.isSystem) - Number(b.isSystem) ||
          b.conversions - a.conversions ||
          b.leadCount - a.leadCount,
      )
      .slice(0, 5)
      .map(({ isSystem, ...rest }) => rest);

    this.logger.log(' Marketing - Admin stats calculated');
    return {
      totalLeads,
      convertedLeads,
      conversionRate,
      leadsBySource,
      topCampaigns,
   };
 }

  // NOTE: getAllRelationshipManagers method was removed as part of RM system deprecation.
}
