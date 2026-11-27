/**
 * Marketing API client for campaign and lead management operations.
 * This module provides functions to interact with the marketing backend endpoints
 * for managing marketing campaigns and leads.
 */

import { stocksApi } from "./api-client";

/**
 * Marketing Campaign interface
 */
export interface MarketingCampaign {
  id: string;
  name: string;
  platform: string;
  platformCampaignId?: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  budget?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Marketing Lead interface
 */
export interface MarketingLead {
  id: string;
  campaignId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  // NOTE: assignedToRMId and assignedRM fields removed as part of RM system deprecation.
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  source: string;
  metadata?: Record<string, any>;
  assignedToId?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  // Relations
  campaign?: MarketingCampaign;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
  };
}

/**
 * Paginated response for leads
 */
export interface PaginatedLeadsResponse {
  data: MarketingLead[];
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
 * 4-stage KYC funnel for marketing leads
 */
export type KycStage =
  | "NOT_INITIATED"
  | "PENDING"
  | "NOT_VERIFIED"
  | "VERIFIED";

/**
 * Last payment status (NA while KYC not initiated, NO_TRANSACTION when the
 * lead has no orders at all)
 */
export type LastPaymentStatus = "NA" | "PENDING" | "PAID" | "NO_TRANSACTION";

/**
 * eSign stage (null = esign never initiated on the relevant order)
 */
export type EsignStage = "COMPLETED" | "NOT_COMPLETED";

/**
 * Lead Analytics interface
 */
export interface LeadAnalytics {
  id: string;
  clientId: string;
  name: string;
  kycStatus: string;
  kycStage: KycStage;
  phoneMasked: string | null;
  lastPaymentStatus: LastPaymentStatus;
  /** eSign stage of the most recent order (null = esign never initiated) */
  esignStage: EsignStage | null;
  /** Lead acquisition source (FACEBOOK, GOOGLE, IMPORTED, ...) */
  source: string | null;
  /** Linked campaign id/name */
  campaignId: string | null;
  campaignName: string | null;
  totalTransactionCount: number;
  totalTransactionValue: number;
  status: string;
  transactionCount: number;
  transactionValue: number;
  sharesRequested: number;
  lastShareName: string | null;
  requestedShareNames: string[];
  paymentStatus: string;
  /** Most-recent activity across lead + linked user/orders (excludes logins) */
  lastActivityAt: string;
}

/**
 * Single transaction snapshot inside a lead detail
 */
export interface LeadDetailTransaction {
  date: string | null;
  shareName: string | null;
  quantity: number | null;
  revenue: number | null;
  source: "" | "Distributor" | null;
  sourceDetails: string | null;
}

/**
 * Full lead detail for the name-popup
 */
export interface LeadDetail {
  clientId: string;
  clientName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  createdOn: string | null;
  lastLoginAt: string | null;
  kycCompletedOn: string | null;
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

/**
 * Lead Analytics Summary interface
 */
export interface LeadAnalyticsSummary {
  totalUsers: number;
  usersInitiatedKyc: number;
  usersCompletedKyc: number;
  usersTransacted: number;
  totalTransactions: number;
  totalTransactionValue: number;
  avgTransactionCountPerUser: number;
  avgTransactionValuePerUser: number;
}

/**
 * Lead Analytics Response
 */
export interface LeadAnalyticsResponse {
  data: LeadAnalytics[];
  summary: LeadAnalyticsSummary;
  /** Distinct acquisition sources present in the DB (powers Source dropdowns) */
  sources?: string[];
  pagination: PaginatedLeadsResponse["pagination"];
}

/**
 * Top Stock interface
 */
export interface TopStock {
  id: string;
  name: string;
  logoUrl: string | null;
  metricValue: number;
  rank: number;
}

/**
 * Top Stocks Response
 */
export interface TopStocksResponse {
  stocks: TopStock[];
}

/**
 * Lead filter options
 */
export interface LeadFilters {
  startDate?: string;
  endDate?: string;
  status?: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  source?: string;
  campaignId?: string;
  search?: string;
  assignedToId?: string;
  // NOTE: assignedToRMId filter removed as part of RM system deprecation.
  sortBy?: "createdAt" | "updatedAt" | "lastActivityAt" | "fullName" | "status";
  sortOrder?: "asc" | "desc";
  lastActivityFrom?: string;
  lastActivityTo?: string;
  page?: number;
  limit?: number;
  /** Client-side only: KYC funnel stage (NOT_INITIATED | PENDING | NOT_VERIFIED | VERIFIED). Stripped before API call. */
  kycStage?: string;
  /** Client-side only: last payment status (NA | PENDING | PAID | NO_TRANSACTION). Stripped before API call. */
  lastPaymentStatus?: string;
  /** Client-side only: esign stage (COMPLETED | NOT_COMPLETED | NONE). Stripped before API call. */
  esignStage?: string;
}

/**
 * Create campaign DTO
 */
export interface CreateCampaignDto {
  name: string;
  platform: string;
  platformCampaignId?: string;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED";
  budget?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Create lead DTO
 */
export interface CreateLeadDto {
  campaignId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  // NOTE: assignedToRMId field removed as part of RM system deprecation.
  status?: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Update lead DTO
 */
export interface UpdateLeadDto {
  fullName?: string;
  email?: string;
  phone?: string;
  status?: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  metadata?: Record<string, any>;
}

// NOTE: AssignLeadDto and MarketingRM interfaces removed as part of RM system deprecation.
// NOTE: assignLeadToRM function removed as part of RM system deprecation.

/**
 * Update lead status DTO
 */
export interface UpdateLeadStatusDto {
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
}

// ============================================
// CAMPAIGN API FUNCTIONS
// ============================================

/**
 * Get all marketing campaigns
 * @returns Promise<MarketingCampaign[]> - Array of campaigns
 * @throws Error with user-friendly message on failure
 */
export async function getAllCampaigns(): Promise<MarketingCampaign[]> {
  try {
    const response = await stocksApi.get("/marketing/campaigns");
    return response.data.campaigns;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch campaigns.";
    throw new Error(errorMessage);
  }
}

/**
 * Get campaign by ID
 * @param campaignId - Campaign unique ID
 * @returns Promise<MarketingCampaign> - Campaign data
 * @throws Error with user-friendly message on failure
 */
export async function getCampaignById(
  campaignId: string,
): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.get(`/marketing/campaigns/${campaignId}`);
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Campaign not found.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch campaign.";
    throw new Error(errorMessage);
  }
}

/**
 * Create new campaign
 * @param campaignData - Campaign creation data
 * @returns Promise<MarketingCampaign> - Created campaign
 * @throws Error with user-friendly message on failure
 */
export async function createCampaign(
  campaignData: CreateCampaignDto,
): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.post("/marketing/campaigns", campaignData);
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 400) {
      throw new Error("Invalid campaign data. Please check your inputs.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to create campaign.";
    throw new Error(errorMessage);
  }
}

/**
 * Update campaign
 * @param campaignId - Campaign unique ID
 * @param updateData - Partial campaign data to update
 * @returns Promise<MarketingCampaign> - Updated campaign
 * @throws Error with user-friendly message on failure
 */
export async function updateCampaign(
  campaignId: string,
  updateData: Partial<CreateCampaignDto>,
): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.patch(
      `/marketing/campaigns/${campaignId}`,
      updateData,
    );
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Campaign not found.");
    }
    if (error.response?.status === 400) {
      throw new Error("Invalid update data. Please check your inputs.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to update campaign.";
    throw new Error(errorMessage);
  }
}

/**
 * Delete campaign
 * @param campaignId - Campaign unique ID
 * @throws Error with user-friendly message on failure
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  try {
    await stocksApi.delete(`/marketing/campaigns/${campaignId}`);
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Campaign not found.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to delete campaign.";
    throw new Error(errorMessage);
  }
}

// ============================================
// LEAD API FUNCTIONS
// ============================================

/**
 * Get all leads with filtering and pagination
 * @param filters - Lead filter options
 * @returns Promise<PaginatedLeadsResponse> - Paginated leads data
 * @throws Error with user-friendly message on failure
 */
export async function getAllLeads(
  filters?: LeadFilters,
): Promise<PaginatedLeadsResponse> {
  try {
    const response = await stocksApi.get("/marketing/leads", {
      params: filters,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to fetch leads.";
    throw new Error(errorMessage);
  }
}

/**
 * Get leads analytics with enriched user/transaction data
 * @param filters - Lead filter options
 * @returns Promise<LeadAnalyticsResponse> - Analytics data
 * @throws Error with user-friendly message on failure
 */
export async function getLeadsAnalytics(
  filters?: LeadFilters,
): Promise<LeadAnalyticsResponse> {
  try {
    // kycStage/lastPaymentStatus/esignStage are computed live per row — the
    // server can't filter on them, so strip before the API call (page applies
    // them client-side on the returned rows).
    const {
      kycStage: _kyc,
      lastPaymentStatus: _pay,
      esignStage: _esign,
      ...serverFilters
    } = filters || {};
    const response = await stocksApi.get("/marketing/leads-analytics", {
      params: serverFilters,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch leads analytics.";
    throw new Error(errorMessage);
  }
}

/**
 * Get top stocks by metric
 * @param sortBy - The metric to sort by
 * @returns Promise<TopStocksResponse> - Top stocks data
 * @throws Error with user-friendly message on failure
 */
export async function getTopStocks(
  sortBy:
    | "transactionCount"
    | "transactionValue"
    | "userRequested"
    | "userWatchlisted" = "transactionCount",
): Promise<TopStocksResponse> {
  try {
    const response = await stocksApi.get("/marketing/top-stocks", {
      params: { sortBy },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch top stocks.";
    throw new Error(errorMessage);
  }
}

/**
 * Get full detail for a single lead (name popup)
 * @param leadId - Lead unique ID
 * @returns Promise<LeadDetail> - Lead detail data
 * @throws Error with user-friendly message on failure
 */
export async function getLeadDetail(leadId: string): Promise<LeadDetail> {
  try {
    const response = await stocksApi.get(`/marketing/leads/${leadId}/detail`);
    return response.data.detail;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Lead not found.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch lead detail.";
    throw new Error(errorMessage);
  }
}

/**
 * Get lead by ID
 * @param leadId - Lead unique ID
 * @returns Promise<MarketingLead> - Lead data
 * @throws Error with user-friendly message on failure
 */
export async function getLeadById(leadId: string): Promise<MarketingLead> {
  try {
    const response = await stocksApi.get(`/marketing/leads/${leadId}`);
    return response.data.lead;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Lead not found.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to fetch lead.";
    throw new Error(errorMessage);
  }
}

/**
 * Create new lead
 * @param leadData - Lead creation data
 * @returns Promise<MarketingLead> - Created lead
 * @throws Error with user-friendly message on failure
 */
export async function createLead(
  leadData: CreateLeadDto,
): Promise<MarketingLead> {
  try {
    const response = await stocksApi.post("/marketing/leads", leadData);
    return response.data.lead;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 400) {
      throw new Error("Invalid lead data. Please check your inputs.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to create lead.";
    throw new Error(errorMessage);
  }
}

/**
 * Update lead
 * @param leadId - Lead unique ID
 * @param updateData - Partial lead data to update
 * @returns Promise<MarketingLead> - Updated lead
 * @throws Error with user-friendly message on failure
 */
export async function updateLead(
  leadId: string,
  updateData: UpdateLeadDto,
): Promise<MarketingLead> {
  try {
    const response = await stocksApi.patch(
      `/marketing/leads/${leadId}`,
      updateData,
    );
    return response.data.lead;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Lead not found.");
    }
    if (error.response?.status === 400) {
      throw new Error("Invalid update data. Please check your inputs.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to update lead.";
    throw new Error(errorMessage);
  }
}

/**
 * Update lead status
 * @param leadId - Lead unique ID
 * @param statusData - Status update data
 * @throws Error with user-friendly message on failure
 */
export async function updateLeadStatus(
  leadId: string,
  statusData: UpdateLeadStatusDto,
): Promise<void> {
  try {
    await stocksApi.patch(`/marketing/leads/${leadId}/status`, statusData);
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    if (error.response?.status === 404) {
      throw new Error("Lead not found.");
    }
    if (error.response?.status === 400) {
      throw new Error("Invalid status data. Please check your inputs.");
    }
    if (!error.response) {
      throw new Error("Network error. Please check your connection.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to update lead status.";
    throw new Error(errorMessage);
  }
}

export async function assignLeadToUser(
  leadId: string,
  userId: string,
): Promise<void> {
  try {
    await stocksApi.patch(`/marketing/leads/${leadId}/assign`, { userId });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to assign lead.";
    throw new Error(errorMessage);
  }
}

/**
 * Bulk assign multiple leads to a user
 */
export async function bulkAssignLeadsToUser(
  leadIds: string[],
  userId: string,
): Promise<void> {
  try {
    await stocksApi.patch("/marketing/leads/bulk-assign", { leadIds, userId });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    if (error.response?.status === 403) {
      throw new Error("Access denied. Marketing Manager role required.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to bulk assign leads.";
    throw new Error(errorMessage);
  }
}

/**
 * Get users eligible for lead assignment
 */
export async function getMarketingPanelUsers(): Promise<any[]> {
  try {
    const response = await stocksApi.get("/marketing/panel-users");
    return response.data.users;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch panel users.";
    throw new Error(errorMessage);
  }
}

// NOTE: getAllRMs function removed as part of RM system deprecation.

/**
 * Syncs database users into marketing leads
 */
export async function syncDatabaseUsers(): Promise<{
  success: boolean;
  count: number;
  message: string;
}> {
  try {
    const response = await stocksApi.post("/marketing/sync-users");
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    const errorMessage =
      error.response?.data?.error || error.message || "Failed to sync users.";
    throw new Error(errorMessage);
  }
}

/**
 * Interface for Dropped Checkout Item
 */
export interface DroppedCheckoutItem {
  id: string;
  orderNumber?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userKycStatus: string;
  stockId?: string;
  stockName: string;
  stockLogoUrl?: string;
  stockIsin?: string;
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  discountApplied: number;
  status: string;
  paymentStatus: string;
  esignDocId?: string | null;
  esignStatus?: string;
  /** eSign stage of this order (null = esign never initiated) */
  esignStage: EsignStage | null;
  cashfreeOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DroppedCheckoutFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface DroppedCheckoutResponse {
  success: boolean;
  data: DroppedCheckoutItem[];
  summary: {
    totalDroppedCount: number;
    totalDroppedValue: number;
    uniqueUsersCount: number;
    avgDroppedValue: number;
  };
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
 * Fetch users who initiated checkout but dropped during payment journey
 */
export async function getDroppedCheckouts(
  filters?: DroppedCheckoutFilters,
): Promise<DroppedCheckoutResponse> {
  try {
    const response = await stocksApi.get<DroppedCheckoutResponse>(
      "/marketing/dropped-checkouts",
      {
        params: filters,
      },
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch dropped checkouts.";
    throw new Error(errorMessage);
  }
}

/**
 * Interface for an e-sign dropout (first-class attempt log row)
 */
export interface EsignDropoutItem {
  id: string;
  docId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userKycStatus: string;
  stockId?: string | null;
  basketId?: string | null;
  stockName: string;
  stockLogoUrl?: string | null;
  stockIsin?: string;
  quantity: number;
  pricePerShare: number | null;
  totalAmount: number | null;
  esignStatus: string;
  esignStage: EsignStage | null;
  orderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EsignDropoutFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface EsignDropoutResponse {
  success: boolean;
  data: EsignDropoutItem[];
  summary: {
    totalEsignDropouts: number;
    totalDropoutValue: number;
    uniqueUsersCount: number;
    signedCount: number;
    avgDropoutValue: number;
  };
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
 * Fetch users who initiated e-sign but never signed (includes sign-first
 * abandons with no Order row)
 */
export async function getEsignDropouts(
  filters?: EsignDropoutFilters,
): Promise<EsignDropoutResponse> {
  try {
    const response = await stocksApi.get<EsignDropoutResponse>(
      "/marketing/esign-dropouts",
      {
        params: filters,
      },
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error("Authentication required. Please login again.");
    }
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Failed to fetch e-sign dropouts.";
    throw new Error(errorMessage);
  }
}
