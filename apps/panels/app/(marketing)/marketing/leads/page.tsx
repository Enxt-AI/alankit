'use client';

import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useLeadsAnalytics, useMarketingCampaigns, useUpdateLeadStatus, useCreateLead, useSyncDatabaseUsers, useAutoSyncDatabaseUsers, type LeadFilters } from '@/hooks/use-marketing-stats';
import MarketingLayout from '@/components/marketing/marketing-layout';
import LeadTable from '@/components/marketing/lead-table';
import LeadDetailDialog from '@/components/marketing/lead-detail-dialog';
import LeadFiltersComponent from '@/components/marketing/lead-filters';
import AddLeadDialog from '@/components/marketing/add-lead-dialog';
import ImportLeadsDialog from '@/components/marketing/import-leads-dialog';
import LeadKanbanBoard from '@/components/marketing/lead-kanban-board';
import LeadOverview from '@/components/marketing/lead-overview';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Plus, AlertCircle, Loader2, LayoutList, KanbanSquare, RefreshCw, Pause, Play } from 'lucide-react';
import { notify } from '@/components/ui/floating-notification';
import type { CreateLeadDto } from '@/lib/marketing-api';

export default function MarketingLeadsPage() {
  const { marketingAdmin, isMarketingLoading } = useMarketingAuth();

  const canView = marketingAdmin?.role === 'SUPER_ADMIN' || marketingAdmin?.permissions?.includes('marketing_view');
  const canExport = marketingAdmin?.role === 'SUPER_ADMIN' || marketingAdmin?.permissions?.includes('marketing_export');
  const canCreate = marketingAdmin?.role === 'SUPER_ADMIN' || 
    marketingAdmin?.permissions?.includes('marketing_lead_assign');

  // Filters state
  const [filters, setFilters] = useState<LeadFilters>({
    page: 1,
    limit: 100, // Increased for board view
  });

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');

  // Dialog states
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // React Query hooks
  const { data: leadsResponse, isLoading: leadsLoading, error: leadsError, refetch: refetchLeads } = useLeadsAnalytics(filters);
  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useMarketingCampaigns();

  // Mutations
  const updateStatusMutation = useUpdateLeadStatus();
  const createLeadMutation = useCreateLead();
  const syncDatabaseMutation = useSyncDatabaseUsers();

  // Auto-sync database users into leads every 2 minutes (pauses when tab
  // hidden or user lacks sync permission). Each sync invalidates the leads
  // queries, so new leads appear in the table automatically.
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const { lastSyncedAt, setLastSyncedAt, isAutoSyncing } = useAutoSyncDatabaseUsers(
    Boolean(canCreate) && autoSyncEnabled,
  );

  const allLeads = leadsResponse?.data || [];
  // Client-side-only filters (kycStage / lastPaymentStatus / esignStage are
  // computed live per row, so the server can't filter on them — the API
  // layer strips them before the request and we apply them here).
  const leads = useMemo(() => {
    return allLeads.filter((lead) => {
      if (filters.kycStage && lead.kycStage !== filters.kycStage) return false;
      if (filters.lastPaymentStatus && lead.lastPaymentStatus !== filters.lastPaymentStatus) return false;
      if (filters.esignStage) {
        const stage = lead.esignStage || 'NONE';
        if (stage !== filters.esignStage) return false;
      }
      return true;
    });
  }, [allLeads, filters.kycStage, filters.lastPaymentStatus, filters.esignStage]);
  // Overview must describe exactly the rows the table shows. The server
  // summary covers all server-matched rows, so when client-side filters hide
  // rows the overview would disagree with the table — recompute from the
  // post-filtered list instead (identical to server numbers when no
  // client-side filter is active).
  const summary = useMemo(() => {
    const usersTransacted = leads.filter((l) => l.transactionCount > 0);
    const totalTransactions = leads.reduce((s, l) => s + (l.transactionCount || 0), 0);
    const totalTransactionValue = leads.reduce((s, l) => s + (l.transactionValue || 0), 0);
    return {
      totalUsers: leads.length,
      usersInitiatedKyc: leads.filter((l) => l.kycStage !== 'NOT_INITIATED').length,
      usersCompletedKyc: leads.filter((l) => l.kycStage === 'VERIFIED').length,
      usersTransacted: usersTransacted.length,
      totalTransactions,
      totalTransactionValue,
      avgTransactionCountPerUser: usersTransacted.length > 0 ? totalTransactions / usersTransacted.length : 0,
      avgTransactionValuePerUser: usersTransacted.length > 0 ? totalTransactionValue / usersTransacted.length : 0,
    };
  }, [leads]);
  const isLoading = leadsLoading || campaignsLoading;
  const error = leadsError || campaignsError;
  const isSyncing = syncDatabaseMutation.isPending;

  const handleExportCSV = () => {
    if (!leads || leads.length === 0) {
      notify.error('No leads available to export');
      return;
    }

    try {
      const data = leads.map(lead => ({
        'Client ID': lead.clientId,
        'Name': lead.name,
        'Phone Number': lead.phoneMasked || '',
        'Source': lead.source || '',
        'KYC Status': lead.kycStage,
        'Last Payment Status': lead.lastPaymentStatus,
        'Dropped at esign': lead.esignStage === 'COMPLETED' ? 'Completed' : lead.esignStage === 'NOT_COMPLETED' ? 'Not completed' : '—',
        'Total Transaction Count': lead.kycStage === 'NOT_INITIATED' ? 'NA' : lead.totalTransactionCount,
        'Successful Transaction Count': lead.transactionCount,
        'Total Transaction Value': lead.kycStage === 'NOT_INITIATED' ? 'NA' : lead.totalTransactionValue,
        'Successful Transaction Value': lead.transactionValue,
        'Successful Shares': lead.sharesRequested,
        'Last Share': lead.kycStage === 'NOT_INITIATED' ? 'NA' : (lead.lastShareName || ''),
        'Shares Requested': (lead.requestedShareNames || []).join(', '),
        'Last Activity': (lead as any).lastActivityAt ? new Date((lead as any).lastActivityAt).toLocaleString('en-IN') : '',
      }));

      const csvString = Papa.unparse(data);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.success('CSV exported successfully');
    } catch (err) {
      console.error('Failed to export CSV:', err);
      notify.error('Failed to export CSV');
    }
  };

  const handleSyncDatabase = async () => {
    try {
      const result = await syncDatabaseMutation.mutateAsync();
      setLastSyncedAt(new Date());
      notify.success(result.message || 'Successfully synced users');
    } catch (error) {
      console.error('Failed to sync users:', error);
      notify.error('Failed to sync users from database');
    }
  };

  const handleStatusChange = (leadId: string, status: string) => {
    handleUpdateLeadStatus(leadId, status);
  };

  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
      await updateStatusMutation.mutateAsync({ leadId, data: { status: status as LeadStatus } });
      notify.success('Lead status updated successfully');
    } catch (error) {
      console.error('Failed to update lead status:', error);
      notify.error('Failed to update lead status');
    }
  };

  const handleCreateLead = async (leadData: CreateLeadDto) => {
    try {
      await createLeadMutation.mutateAsync(leadData);
      notify.success('Lead created successfully');
    } catch (error: any) {
      console.error('Failed to create lead:', error);
      throw error;
    }
  };

  const handleFiltersChange = (newFilters: LeadFilters) => {
    setFilters(newFilters);
  };

  if (error) {
    return (
      <MarketingLayout>
        <div className="max-w-7xl mx-auto space-y-8">
          <Alert className="border-red-200 bg-red-50 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load leads data.{' '}
              <button
                onClick={() => refetchLeads()}
                className="underline hover:no-underline font-medium"
              >
                Try again
              </button>
            </AlertDescription>
          </Alert>
        </div>
      </MarketingLayout>
    );
  }

  if (!canView && !isMarketingLoading) {
    return (
      <MarketingLayout>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-6 bg-white rounded-[24px] border border-neutral-200/40 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 border border-red-200/50 mb-6">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Denied</h1>
            <p className="text-sm text-[#64748B] font-medium mt-4 leading-relaxed">
              You do not have permission to view data within the Marketing module. Please contact your administrator to request the "Viewer Permission" role.
            </p>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              Marketing Leads
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Manage and track your marketing leads
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canExport && (
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="border-2 border-neutral-200 text-[#0F172A] hover:bg-neutral-50 active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4 flex items-center gap-1"
              >
                Export CSV
              </Button>
            )}
            {canCreate && (
              <>
                <Button
                  onClick={handleSyncDatabase}
                  disabled={isSyncing}
                  variant="outline"
                  title={lastSyncedAt ? `Last synced at ${lastSyncedAt.toLocaleTimeString('en-IN')}` : 'Not synced yet this session'}
                  className="border-2 border-neutral-200 text-[#0F172A] hover:bg-neutral-50 active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4 flex items-center gap-1"
                >
                  {isSyncing || isAutoSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync Database
                </Button>
                <Button
                  onClick={() => setAutoSyncEnabled((v) => !v)}
                  variant="outline"
                  title={autoSyncEnabled ? 'Auto-sync every 2 minutes is ON — click to pause' : 'Auto-sync is paused — click to resume'}
                  className={`border-2 rounded-lg font-semibold h-10 px-3 flex items-center gap-1.5 transition-all duration-300 ease-in-out active:scale-[0.98] ${
                    autoSyncEnabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-neutral-200 text-[#64748B] hover:bg-neutral-50'
                  }`}
                >
                  {autoSyncEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span className="text-xs">
                    {autoSyncEnabled
                      ? lastSyncedAt
                        ? `Auto-sync on • ${lastSyncedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Auto-sync on • 2m'
                      : 'Auto-sync off'}
                  </span>
                </Button>
                <Button
                  onClick={() => setImportDialogOpen(true)}
                  variant="outline"
                  className="border-2 border-neutral-200 text-[#0F172A] hover:bg-neutral-50 active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4 flex items-center gap-1"
                >
                  Import CSV
                </Button>
              </>
            )}
            <Button
              onClick={() => setAddLeadDialogOpen(true)}
              className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <LeadOverview summary={summary} isLoading={isLoading} />

        {/* Filters */}
        <LeadFiltersComponent
          filters={filters}
          onFilterChange={handleFiltersChange}
          campaigns={campaigns || []}
          sources={leadsResponse?.sources || []}
        />

        {/* Leads Table / Board Panel */}
        <div 
          className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden font-semibold"
          style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
        >
          <div className="pb-4 border-b border-neutral-200/40 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Leads</h3>
              <p className="text-xs text-[#64748B] mt-0.5">All your marketing leads and their current status</p>
            </div>
            
            <div className="inline-flex items-center gap-1 h-[38px] rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'table' 
                    ? 'bg-white text-neutral-900 shadow-sm font-bold' 
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <LayoutList className="h-4 w-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                  viewMode === 'board' 
                    ? 'bg-white text-neutral-900 shadow-sm font-bold' 
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <KanbanSquare className="h-4 w-4" />
                Board
              </button>
            </div>
          </div>

          <div className="p-6 pt-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="ml-3 text-sm text-[#64748B] font-semibold">Loading leads...</span>
              </div>
            ) : leads.length > 0 ? (
              viewMode === 'table' ? (
                <LeadTable
                  leads={leads}
                  onLeadClick={(leadId) => setSelectedLeadId(leadId)}
                  hiddenUpstreamCount={allLeads.length - leads.length}
                  sources={leadsResponse?.sources || []}
                />
              ) : (
                <LeadKanbanBoard
                  leads={leads}
                  onStatusChange={handleStatusChange}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-4">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">{allLeads.length > 0 ? 'All leads hidden by filters' : 'No leads found'}</h3>
                <p className="text-xs text-[#64748B] text-center max-w-[340px]">
                  {allLeads.length > 0
                    ? `${allLeads.length} lead${allLeads.length === 1 ? '' : 's'} matched, but all were hidden by the Filter Leads panel (e.g. Last Payment Status) — Clear all to view.`
                    : 'Try adjusting your filters or create your first marketing campaign to generate leads.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Add Lead Dialog */}
        <AddLeadDialog
          open={addLeadDialogOpen}
          onOpenChange={setAddLeadDialogOpen}
          campaigns={campaigns || []}
          onSubmit={handleCreateLead}
        />

        {/* Import Leads Dialog */}
        <ImportLeadsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={() => refetchLeads()}
        />

        {/* Lead Detail Dialog (name click) */}
        <LeadDetailDialog
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      </div>
    </MarketingLayout>
  );
}
