/**
 * Marketing statistics API functions
 * Provides aggregated data for marketing team dashboards and detailed reports
 *
 * AUDIENCE: Marketing managers and team members
 * DATA SOURCE: Computed from raw marketing campaigns and leads data via marketing-api
 * PURPOSE: Detailed analytics, performance tracking, and campaign management insights
 */

import { getAllCampaigns, getAllLeads, type MarketingCampaign, type MarketingLead } from '@/lib/marketing-api';
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
  campaigns: MarketingCampaign[];
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
 * Fetch aggregated marketing dashboard statistics
 * Computes stats from campaigns and leads data
 *
 * @returns Promise<MarketingDashboardStats> - Dashboard statistics
 */
export async function getMarketingDashboardStats(): Promise<MarketingDashboardStats> {
  try {
    const [campaigns, leadsResponse] = await Promise.all([
      getAllCampaigns(),
      getAllLeads(),
    ]);

    const leads = leadsResponse.data;
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status === 'CONVERTED').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    const totalRevenue = leads
      .filter(l => l.status === 'CONVERTED')
      .reduce((sum, lead) => sum + (lead.metadata?.conversionValue || 0), 0);

    // Lead sources breakdown
    const leadSources = leads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent leads (last 5)
    const recentLeads = leads
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalLeads,
      convertedLeads,
      conversionRate,
      totalRevenue,
      leadSources,
      recentLeads,
      campaigns: campaigns.slice(0, 6), // Top 6 campaigns for dashboard
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
export async function getMarketingReportStats(): Promise<MarketingReportStats> {
  try {
    const [campaigns, leadsResponse] = await Promise.all([
      getAllCampaigns(),
      getAllLeads(),
    ]);

    const leads = leadsResponse.data;

    // Monthly performance (current month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyLeads = leads.filter(lead => {
      const leadDate = new Date(lead.createdAt);
      return leadDate >= monthStart && leadDate <= monthEnd;
    });

    const monthlyConversions = monthlyLeads.filter(l => l.status === 'CONVERTED').length;
    const monthlyRevenue = monthlyLeads
      .filter(l => l.status === 'CONVERTED')
      .reduce((sum, lead) => sum + (lead.metadata?.conversionValue || 0), 0);

    // Lead sources breakdown (monthly)
    const leadSources = monthlyLeads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top performing campaigns
    const topCampaigns = campaigns
      .map(campaign => {
        const campaignLeads = leads.filter(l => l.campaignId === campaign.id);
        const conversions = campaignLeads.filter(l => l.status === 'CONVERTED').length;
        const revenue = campaignLeads
          .filter(l => l.status === 'CONVERTED')
          .reduce((sum, lead) => sum + (lead.metadata?.conversionValue || 0), 0);

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

    // Weekly trend (last 7 days)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
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
        leads: monthlyLeads.length,
        conversions: monthlyConversions,
        revenue: monthlyRevenue,
        conversionRate: monthlyLeads.length > 0 ? (monthlyConversions / monthlyLeads.length) * 100 : 0,
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
    const [campaign, leadsResponse] = await Promise.all([
      stocksApi.get(`/marketing/campaigns/${campaignId}`),
      getAllLeads({ campaignId }),
    ]);

    const leads = leadsResponse.data;
    const leadCount = leads.length;
    const conversions = leads.filter(l => l.status === 'CONVERTED').length;
    const revenue = leads
      .filter(l => l.status === 'CONVERTED')
      .reduce((sum, lead) => sum + (lead.metadata?.conversionValue || 0), 0);

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