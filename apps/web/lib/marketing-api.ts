/**
 * Marketing API client for campaign and lead management operations.
 * This module provides functions to interact with the marketing backend endpoints
 * for managing marketing campaigns and leads.
 */

import { stocksApi } from './api-client';

/**
 * Marketing Campaign interface
 */
export interface MarketingCampaign {
  id: string;
  name: string;
  platform: string;
  platformCampaignId?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
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
  // NOTE: assignedToRMId field removed -- RM system deprecated
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  source: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  // Relations
  campaign?: MarketingCampaign;
  // NOTE: assignedRM relation removed -- RM system deprecated
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
 * Lead filter options
 */
export interface LeadFilters {
  startDate?: string;
  endDate?: string;
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  source?: string;
  campaignId?: string;
  search?: string;
  // NOTE: assignedToRMId filter removed -- RM system deprecated
  sortBy?: 'createdAt' | 'updatedAt' | 'lastActivityAt' | 'fullName' | 'status';
  sortOrder?: 'asc' | 'desc';
  lastActivityFrom?: string;
  lastActivityTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Create campaign DTO
 */
export interface CreateCampaignDto {
  name: string;
  platform: string;
  platformCampaignId?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
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
  // NOTE: assignedToRMId field removed -- RM system deprecated
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
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
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  metadata?: Record<string, any>;
}

// NOTE: AssignLeadDto interface removed -- RM system deprecated

/**
 * Update lead status DTO
 */
export interface UpdateLeadStatusDto {
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
}

// NOTE: MarketingRM interface removed -- RM system deprecated

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
    const response = await stocksApi.get('/marketing/campaigns');
    return response.data.campaigns;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch campaigns.';
    throw new Error(errorMessage);
  }
}

/**
 * Get campaign by ID
 * @param campaignId - Campaign unique ID
 * @returns Promise<MarketingCampaign> - Campaign data
 * @throws Error with user-friendly message on failure
 */
export async function getCampaignById(campaignId: string): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.get(`/marketing/campaigns/${campaignId}`);
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Campaign not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch campaign.';
    throw new Error(errorMessage);
  }
}

/**
 * Create new campaign
 * @param campaignData - Campaign creation data
 * @returns Promise<MarketingCampaign> - Created campaign
 * @throws Error with user-friendly message on failure
 */
export async function createCampaign(campaignData: CreateCampaignDto): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.post('/marketing/campaigns', campaignData);
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid campaign data. Please check your inputs.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to create campaign.';
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
  updateData: Partial<CreateCampaignDto>
): Promise<MarketingCampaign> {
  try {
    const response = await stocksApi.patch(`/marketing/campaigns/${campaignId}`, updateData);
    return response.data.campaign;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Campaign not found.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid update data. Please check your inputs.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to update campaign.';
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
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Campaign not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to delete campaign.';
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
export async function getAllLeads(filters?: LeadFilters): Promise<PaginatedLeadsResponse> {
  try {
    const response = await stocksApi.get('/marketing/leads', { params: filters });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch leads.';
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
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Lead not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch lead.';
    throw new Error(errorMessage);
  }
}

/**
 * Create new lead
 * @param leadData - Lead creation data
 * @returns Promise<MarketingLead> - Created lead
 * @throws Error with user-friendly message on failure
 */
export async function createLead(leadData: CreateLeadDto): Promise<MarketingLead> {
  try {
    const response = await stocksApi.post('/marketing/leads', leadData);
    return response.data.lead;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid lead data. Please check your inputs.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to create lead.';
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
  updateData: UpdateLeadDto
): Promise<MarketingLead> {
  try {
    const response = await stocksApi.patch(`/marketing/leads/${leadId}`, updateData);
    return response.data.lead;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Lead not found.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid update data. Please check your inputs.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to update lead.';
    throw new Error(errorMessage);
  }
}

// NOTE: assignLeadToRM function removed -- RM system deprecated

/**
 * Update lead status
 * @param leadId - Lead unique ID
 * @param statusData - Status update data
 * @throws Error with user-friendly message on failure
 */
export async function updateLeadStatus(
  leadId: string,
  statusData: UpdateLeadStatusDto
): Promise<void> {
  try {
    await stocksApi.patch(`/marketing/leads/${leadId}/status`, statusData);
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please login again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    if (error.response?.status === 404) {
      throw new Error('Lead not found.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid status data. Please check your inputs.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to update lead status.';
    throw new Error(errorMessage);
  }
}

// NOTE: getAllRMs function removed -- RM system deprecated