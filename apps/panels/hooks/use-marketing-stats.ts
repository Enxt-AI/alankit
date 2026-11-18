/**
 * TanStack Query hooks for fetching marketing dashboard statistics
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// NOTE: RM assignment imports (assignLeadToRM, getAllRMs, AssignLeadDto, MarketingRM) removed -- RM system deprecated
import { getAllCampaigns, getAllLeads, getLeadsAnalytics, getLeadDetail, getTopStocks, updateLeadStatus, createLead, createCampaign, updateCampaign, deleteCampaign, assignLeadToUser, bulkAssignLeadsToUser, getMarketingPanelUsers, syncDatabaseUsers, getDroppedCheckouts, getEsignDropouts, type MarketingCampaign, type MarketingLead, type LeadFilters, type UpdateLeadStatusDto, type CreateLeadDto, type CreateCampaignDto, type DroppedCheckoutFilters, type DroppedCheckoutItem, type DroppedCheckoutResponse, type EsignDropoutFilters, type EsignDropoutItem, type EsignDropoutResponse, type LeadDetail } from '@/lib/marketing-api';
import { getMarketingDashboardStats, getMarketingReportStats, type MarketingDashboardStats, type MarketingReportStats } from '@/lib/marketing-stats-api';

// Re-export types for convenience
export type { LeadFilters, MarketingCampaign, MarketingLead, LeadAnalyticsResponse, TopStocksResponse, DroppedCheckoutFilters, DroppedCheckoutItem, DroppedCheckoutResponse, EsignDropoutFilters, EsignDropoutItem, EsignDropoutResponse, LeadDetail, KycStage, LastPaymentStatus, EsignStage, LeadDetailTransaction } from '@/lib/marketing-api';
export type { MarketingDashboardStats, MarketingReportStats } from '@/lib/marketing-stats-api';

/**
 * Hook to fetch all marketing campaigns
 * Used for campaign lists and dropdowns
 *
 * @returns TanStack Query result with array of campaigns
 */
export function useMarketingCampaigns() {
  return useQuery<MarketingCampaign[]>({
    queryKey: ['marketing', 'campaigns'],
    queryFn: getAllCampaigns,
    staleTime: 60000, // 1 minute - campaigns don't change frequently
    refetchOnWindowFocus: false,
  });
}

import { useMarketingAuth } from './use-marketing-auth';

/**
 * Hook to fetch marketing leads with optional filters
 * Used for lead tables and filtered views
 *
 * @param filters - Optional filters for leads (status, source, campaign, dates, search)
 * @returns TanStack Query result with paginated leads data
 */
export function useMarketingLeads(filters?: LeadFilters) {
  const { marketingAdmin } = useMarketingAuth();
  return useQuery({
    queryKey: ['marketing', 'leads', marketingAdmin?.id, filters],
    queryFn: () => getAllLeads(filters),
    staleTime: 30000, // 30 seconds - leads change more frequently
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch marketing leads with enriched analytics
 * Used for the new leads table and overview
 *
 * @param filters - Optional filters for leads (status, source, campaign, dates, search)
 */
export function useLeadsAnalytics(filters?: LeadFilters) {
  const { marketingAdmin } = useMarketingAuth();
  return useQuery({
    queryKey: ['marketing', 'leads-analytics', marketingAdmin?.id, filters],
    queryFn: () => getLeadsAnalytics(filters),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    // Poll so newly synced/created leads appear without a manual refresh.
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    refetchIntervalInBackground: false, // pause polling when tab is hidden
  });
}

/**
 * Hook to fetch top stocks based on a metric
 * Used for the reports page
 *
 * @param sortBy - The metric to sort by
 */
export function useTopStocks(sortBy: 'transactionCount' | 'transactionValue' | 'userRequested' | 'userWatchlisted' = 'transactionCount') {
  return useQuery({
    queryKey: ['marketing', 'top-stocks', sortBy],
    queryFn: () => getTopStocks(sortBy),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch aggregated marketing dashboard statistics
 * Includes KPIs and summary data for dashboard overview
 *
 * @returns TanStack Query result with dashboard stats
 */
export function useMarketingDashboardStats() {
  return useQuery({
    queryKey: ['marketing', 'dashboard-stats'],
    queryFn: getMarketingDashboardStats,
    staleTime: 60000, // 1 minute - dashboard stats
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch marketing report statistics
 * Includes detailed analytics for reports page
 *
 * @param filters - Optional filters (startDate, endDate)
 * @returns TanStack Query result with report stats
 */
export function useMarketingReportStats(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['marketing', 'report-stats', filters],
    queryFn: () => getMarketingReportStats(filters),
    staleTime: 60000, // 1 minute - report stats
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to assign a lead to a user
 */
export function useAssignLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, userId }: { leadId: string; userId: string }) =>
      assignLeadToUser(leadId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to bulk assign leads to a user
 */
export function useBulkAssignLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadIds, userId }: { leadIds: string[]; userId: string }) =>
      bulkAssignLeadsToUser(leadIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to fetch users eligible for lead assignment
 */
export function useMarketingPanelUsers() {
  return useQuery({
    queryKey: ['marketing', 'panel-users'],
    queryFn: getMarketingPanelUsers,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to update lead status
 * Invalidates leads queries on success
 *
 * @returns TanStack Mutation result for status update
 */
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: UpdateLeadStatusDto }) =>
      updateLeadStatus(leadId, data),
    onSuccess: () => {
      // Invalidate and refetch leads queries
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to create a new marketing lead
 * Used for the add lead dialog
 *
 * @returns TanStack Query mutation for creating leads
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadData: CreateLeadDto) => createLead(leadData),
    onSuccess: () => {
      // Invalidate and refetch leads queries to show the new lead
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to create a new marketing campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignData: CreateCampaignDto) => createCampaign(campaignData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to update a marketing campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: Partial<CreateCampaignDto> }) =>
      updateCampaign(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Hook to delete a marketing campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

// NOTE: useMarketingRMs hook removed -- RM system deprecated

/**
 * Hook to sync database users to marketing leads
 */
export function useSyncDatabaseUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncDatabaseUsers(),
    onSuccess: () => {
      // Invalidate leads queries to show the newly synced leads
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'leads-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'report-stats'] });
    },
  });
}

/**
 * Auto-sync interval shared by the leads auto-sync hook and table polling.
 */
export const LEADS_AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Automatically sync database users into marketing leads on an interval.
 * Skips ticks while the tab is hidden or a sync is already in flight.
 * Each successful sync invalidates the leads queries (via useSyncDatabaseUsers),
 * so new leads appear in the table automatically.
 *
 * @param enabled - master switch (e.g. only when the user can sync)
 * @param intervalMs - polling interval, defaults to 2 minutes
 * @returns last synced timestamp, syncing flag, and any error
 */
export function useAutoSyncDatabaseUsers(enabled: boolean, intervalMs: number = LEADS_AUTO_SYNC_INTERVAL_MS) {
  const syncMutation = useSyncDatabaseUsers();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mutateRef = useRef(syncMutation.mutateAsync);
  mutateRef.current = syncMutation.mutateAsync;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      mutateRef.current()
        .then(() => {
          setLastSyncedAt(new Date());
          setAutoSyncError(null);
        })
        .catch((err: any) => {
          setAutoSyncError(err?.message || 'Auto-sync failed');
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return {
    lastSyncedAt,
    setLastSyncedAt,
    autoSyncError,
    isAutoSyncing: syncMutation.isPending,
  };
}

/**
 * Hook to fetch full detail for a single lead (name popup)
 * Only fetches when leadId is set (dialog open)
 *
 * @param leadId - Lead ID or null
 */
export function useLeadDetail(leadId: string | null) {
  return useQuery({
    queryKey: ['marketing', 'lead-detail', leadId],
    queryFn: () => getLeadDetail(leadId as string),
    enabled: !!leadId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch users who initiated checkout but dropped during payment journey
 */
export function useDroppedCheckouts(filters?: DroppedCheckoutFilters) {
  const { marketingAdmin } = useMarketingAuth();
  return useQuery({
    queryKey: ['marketing', 'dropped-checkouts', marketingAdmin?.id, filters],
    queryFn: () => getDroppedCheckouts(filters),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch users who initiated e-sign but never signed
 */
export function useEsignDropouts(filters?: EsignDropoutFilters) {
  const { marketingAdmin } = useMarketingAuth();
  return useQuery({
    queryKey: ['marketing', 'esign-dropouts', marketingAdmin?.id, filters],
    queryFn: () => getEsignDropouts(filters),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}