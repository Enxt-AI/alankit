/**
 * Marketing statistics API functions
 * Provides aggregated data for marketing team dashboards and detailed reports
 *
 * AUDIENCE: Marketing managers and team members
 * DATA SOURCE: Computed from raw marketing campaigns and leads data via marketing-api
 * PURPOSE: Detailed analytics, performance tracking, and campaign management insights
 */

import { getAllCampaigns, getAllLeads, getLeadsAnalytics, type MarketingCampaign, type MarketingLead, type LeadAnalytics, type LeadFilters } from '@/lib/marketing-api';
import { stocksApi } from '@/lib/api-client';

/**
 * Dashboard statistics interface
 */
export interface MarketingDashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalRevenue: number;
  leadSources: Record<string, number>;
  recentLeads: MarketingLead[];
  campaigns: Array<MarketingCampaign & {
    leadCount: number;
    conversions: number;
    revenue: number;
  }>;
}

/**
 * Report statistics interface
 */
export interface MarketingReportStats {
  monthlyPerformance: {
    leads: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  };
  leadSources: Record<string, number>;
  topCampaigns: Array<MarketingCampaign & {
    leadCount: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  weeklyTrend: Array<{
    date: string;
    leads: number;
  }>;
}

/**
 * Fetch ALL leads across every page.
 * The backend defaults to limit=20, so a single getAllLeads() call only
 * returns the first page — aggregating from it undercounts (e.g. Total
 * Leads showed 20 while campaigns held 39+ leads).
 */
async function fetchAllLeads(baseFilters?: LeadFilters): Promise<MarketingLead[]> {
  const all: MarketingLead[] = [];
  let page = 1;
  for (;;) {
    const response = await getAllLeads({ ...baseFilters, page, limit: 100 });
    all.push(...response.data);
    const pagination = response.pagination;
    if (!pagination || !pagination.hasNextPage || response.data.length === 0) break;
    page += 1;
  }
  return all;
}

/**
 * Fetch ALL lead analytics rows across every page (same pagination trap as
 * fetchAllLeads). Conversion/revenue are derived from successful (PAID)
 * transactions, not the CONVERTED lead status / conversionValue metadata,
 * which nothing in the system ever sets (they were permanently 0).
 */
async function fetchAllLeadAnalytics(baseFilters?: LeadFilters): Promise<LeadAnalytics[]> {
  const all: LeadAnalytics[] = [];
  let page = 1;
  for (;;) {
    const response = await getLeadsAnalytics({ ...baseFilters, page, limit: 100 });
    all.push(...response.data);
    const pagination = response.pagination;
    if (!pagination || !pagination.hasNextPage || response.data.length === 0) break;
    page += 1;
  }
  return all;
}

/**
 * Fetch aggregated marketing dashboard statistics
 * Computes stats from campaigns and leads data
 *
 * @returns Promise<MarketingDashboardStats> - Dashboard statistics
 */
export async function getMarketingDashboardStats(): Promise<MarketingDashboardStats> {
  try {
    const [campaigns, leads, analytics] = await Promise.all([
      getAllCampaigns(),
      fetchAllLeads(),
      fetchAllLeadAnalytics(),
    ]);

    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    const totalLeads = leads.length;
    // Converted = lead has at least one successful (PAID) transaction.
    const transactedLeadIds = new Set(
      analytics.filter(a => a.transactionCount > 0).map(a => a.id),
    );
    const convertedLeads = transactedLeadIds.size;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    const totalRevenue = analytics.reduce((sum, a) => sum + (a.transactionValue || 0), 0);

    // Lead sources breakdown
    const leadSources = leads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent leads (last 5)
    const recentLeads = leads
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Per-campaign conversion + revenue (successful PAID transactions).
    // Grid-mode cards and the details drawer read these fields — without
    // them the cards rendered NaN% conversion and ₹0 revenue.
    const analyticsByLeadId = new Map(analytics.map(a => [a.id, a]));
    const campaignsWithStats = campaigns.slice(0, 6).map(campaign => {
      const campaignLeads = leads.filter(l => l.campaignId === campaign.id);
      const conversions = campaignLeads.filter(
        l => (analyticsByLeadId.get(l.id)?.transactionCount || 0) > 0,
      ).length;
      const revenue = campaignLeads.reduce(
        (sum, l) => sum + (analyticsByLeadId.get(l.id)?.transactionValue || 0), 0,
      );
      return {
        ...campaign,
        leadCount: campaignLeads.length,
        conversions,
        revenue,
      };
    });

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalLeads,
      convertedLeads,
      conversionRate,
      totalRevenue,
      leadSources,
      recentLeads,
      campaigns: campaignsWithStats, // Top 6 campaigns for dashboard
    };
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
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch dashboard stats.';
    throw new Error(errorMessage);
  }
}

/**
 * Fetch marketing report statistics
 * Computes detailed analytics from campaigns and leads data
 *
 * @returns Promise<MarketingReportStats> - Report statistics
 */
export async function getMarketingReportStats(
  filters?: { startDate?: string; endDate?: string }
): Promise<MarketingReportStats> {
  try {
    const [campaigns, leads, analytics] = await Promise.all([
      getAllCampaigns(),
      fetchAllLeads(), // we could pass filters here, but since it's cached let's filter in memory
      fetchAllLeadAnalytics(),
    ]);

    // Successful-transaction lookup by lead id (conversion = ≥1 PAID order).
    const analyticsByLeadId = new Map(analytics.map(a => [a.id, a]));
    const isConverted = (leadId: string) => (analyticsByLeadId.get(leadId)?.transactionCount || 0) > 0;
    const leadRevenue = (leadId: string) => analyticsByLeadId.get(leadId)?.transactionValue || 0;

    // Filter by date range (default to last 30 days if not provided)
    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30);
    
    const startDate = filters?.startDate ? new Date(filters.startDate) : defaultStart;
    const endDate = filters?.endDate ? new Date(filters.endDate) : now;
    
    // Ensure endDate covers the whole day
    endDate.setHours(23, 59, 59, 999);

    const filteredLeads = leads.filter(lead => {
      const leadDate = new Date(lead.createdAt);
      return leadDate >= startDate && leadDate <= endDate;
    });

    const monthlyConversions = filteredLeads.filter(l => isConverted(l.id)).length;
    const monthlyRevenue = filteredLeads
      .reduce((sum, lead) => sum + leadRevenue(lead.id), 0);

    // Lead sources breakdown (filtered)
    const leadSources = filteredLeads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top performing campaigns (based on filtered leads)
    const topCampaigns = campaigns
      .map(campaign => {
        const campaignLeads = filteredLeads.filter(l => l.campaignId === campaign.id);
        const conversions = campaignLeads.filter(l => isConverted(l.id)).length;
        const revenue = campaignLeads
          .reduce((sum, lead) => sum + leadRevenue(lead.id), 0);

        return {
          ...campaign,
          leadCount: campaignLeads.length,
          conversions,
          revenue,
          conversionRate: campaignLeads.length > 0 ? (conversions / campaignLeads.length) * 100 : 0,
        };
      })
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);

    // Weekly trend (last 7 days from endDate)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

      const dayLeads = leads.filter(lead => {
        const leadDate = new Date(lead.createdAt);
        return leadDate >= dayStart && leadDate < dayEnd;
      });

      weeklyTrend.push({
        date: date.toISOString().split('T')[0]!,
        leads: dayLeads.length,
      });
    }

    return {
      monthlyPerformance: {
        leads: filteredLeads.length,
        conversions: monthlyConversions,
        revenue: monthlyRevenue,
        conversionRate: filteredLeads.length > 0 ? (monthlyConversions / filteredLeads.length) * 100 : 0,
      },
      leadSources,
      topCampaigns,
      weeklyTrend,
    };
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
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch report stats.';
    throw new Error(errorMessage);
  }
}

/**
 * Fetch individual campaign performance statistics
 * Computes stats for a specific campaign
 *
 * @param campaignId - Unique campaign identifier
 * @returns Promise with campaign performance data
 */
export async function getCampaignPerformance(campaignId: string) {
  try {
    const [campaign, leads, analytics] = await Promise.all([
      stocksApi.get(`/marketing/campaigns/${campaignId}`),
      fetchAllLeads({ campaignId }),
      fetchAllLeadAnalytics({ campaignId }),
    ]);

    const leadCount = leads.length;
    const conversions = analytics.filter(a => a.transactionCount > 0).length;
    const revenue = analytics
      .reduce((sum, a) => sum + (a.transactionValue || 0), 0);

    return {
      campaign: campaign.data.campaign,
      leadCount,
      conversions,
      revenue,
      conversionRate: leadCount > 0 ? (conversions / leadCount) * 100 : 0,
    };
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
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch campaign performance.';
    throw new Error(errorMessage);
  }
}