'use client';

import { useState } from 'react';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useMarketingDashboardStats, useMarketingCampaigns, useDroppedCheckouts, type MarketingCampaign } from '@/hooks/use-marketing-stats';
import MarketingLayout from '@/components/marketing/marketing-layout';
import { Target, Users, TrendingUp, DollarSign, Plus, LayoutGrid, List, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import CampaignTable from '@/components/marketing/campaign-table';
import CampaignStatsCard from '@/components/marketing/campaign-stats-card';
import CreateCampaignDialog from '@/components/marketing/create-campaign-dialog';
import DeleteCampaignDialog from '@/components/marketing/delete-campaign-dialog';
import CampaignDetailsDrawer from '@/components/marketing/campaign-details-drawer';
import DroppedCheckoutsTable from '@/components/marketing/dropped-checkouts-table';

export default function MarketingDashboardPage() {
  const { marketingAdmin, isMarketingLoading } = useMarketingAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [activeSection, setActiveSection] = useState<'campaigns' | 'dropped_checkouts'>('campaigns');
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  
  // Selected campaign state
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);

  console.log('[DEBUG Dashboard] marketingAdmin:', marketingAdmin);
  const canView = 
    marketingAdmin?.role === 'SUPER_ADMIN' || 
    marketingAdmin?.permissions?.includes('marketing_dashboard_view');

  const hasMarketingView = 
    marketingAdmin?.role === 'SUPER_ADMIN' || 
    marketingAdmin?.permissions?.includes('marketing_view');
  
  // Queries
  const { data: stats, isLoading: statsLoading, error: statsError } = useMarketingDashboardStats();
  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useMarketingCampaigns();
  const { data: droppedResponse, isLoading: droppedLoading } = useDroppedCheckouts();

  const isLoading = statsLoading || campaignsLoading;
  const error = statsError || campaignsError;

  const handleEdit = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setCreateDialogOpen(true);
  };

  const handleDelete = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setDetailsDrawerOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedCampaign(null);
    setCreateDialogOpen(true);
  };

  if (error) {
    return (
      <MarketingLayout>
        <div className="max-w-7xl mx-auto space-y-8 p-6">
          <Alert className="border-red-200 bg-red-50 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load dashboard data.
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
      <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12 px-4 sm:px-6 lg:px-8 mt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              Marketing Dashboard
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Manage marketing campaigns and track overall performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeSection === 'campaigns' && (
              <>
                <div className="flex items-center p-1 bg-neutral-100 rounded-lg border border-neutral-200 mr-2">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={handleCreateNew}
                  className="border-2 border-[#16A34A] bg-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out rounded-lg font-semibold h-10 px-4 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  New Campaign
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-[20px] border border-neutral-200/40 p-6 h-[120px]">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              <div className="flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><Target className="h-5 w-5" /></span>
                <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Active Campaigns</span><span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{stats?.activeCampaigns || 0}</span><span className="mt-1 block text-[11px] font-semibold text-[#64748B]">Out of {stats?.totalCampaigns || 0} total</span></span>
              </div>

              <div className="flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><Users className="h-5 w-5" /></span>
                <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total Leads</span><span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{stats?.totalLeads || 0}</span><span className="mt-1 block text-[11px] font-semibold text-[#64748B]">Across all campaigns</span></span>
              </div>

              <div className="flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><TrendingUp className="h-5 w-5" /></span>
                <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Conversion Rate</span><span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{stats?.conversionRate?.toFixed(1) || '0.0'}%</span><span className="mt-1 block text-[11px] font-semibold text-[#64748B]">{stats?.convertedLeads || 0} transacted</span></span>
              </div>

              <div className="flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><DollarSign className="h-5 w-5" /></span>
                <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total Revenue</span><span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">₹{(stats?.totalRevenue || 0).toLocaleString('en-IN')}</span><span className="mt-1 block text-[11px] font-semibold text-[#64748B]">From successful transactions</span></span>
              </div>

              {/* Dropped Checkouts KPI Card */}
              {hasMarketingView && (
                <div
                  onClick={() => setActiveSection('dropped_checkouts')}
                  className={`flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border cursor-pointer transition-all ${activeSection === 'dropped_checkouts' ? 'border-[#16A34A]/40 shadow-[0_8px_30px_rgba(22,163,74,0.12)]' : 'border-neutral-200/40 hover:border-[#16A34A]/30'}`}
                  style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]"><ShoppingBag className="h-5 w-5" /></span>
                  <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Dropped Checkouts</span><span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{droppedResponse?.summary?.totalDroppedCount || 0}</span><span className="mt-1 block text-[11px] font-semibold text-[#64748B]">₹{(droppedResponse?.summary?.totalDroppedValue || 0).toLocaleString('en-IN')} to recover</span></span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Section Navigation Tabs — admin TabsList pattern */}
        <div className="inline-flex items-center gap-1 h-[38px] rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1">
          <button
            onClick={() => setActiveSection('campaigns')}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all ${activeSection === 'campaigns' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            Campaigns
          </button>
          {hasMarketingView && (
            <button
              onClick={() => setActiveSection('dropped_checkouts')}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all flex items-center gap-2 ${activeSection === 'dropped_checkouts' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
            >
              <ShoppingBag className="h-4 w-4" />
              Dropped Checkouts
              {droppedResponse?.summary?.totalDroppedCount ? (
                <span className="ml-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                  {droppedResponse.summary.totalDroppedCount}
                </span>
              ) : null}
            </button>
          )}
        </div>

        {/* Dynamic Section Content */}
        {activeSection === 'campaigns' ? (
          <div 
            className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <div className="pb-4 border-b border-neutral-200/40 p-6">
              <h3 className="text-base font-bold text-[#0F172A]">All Campaigns</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Manage your active and past campaigns</p>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : campaigns && campaigns.length > 0 ? (
                viewMode === 'table' ? (
                  <div className="rounded-xl border border-neutral-200/60 overflow-hidden">
                    <CampaignTable 
                      campaigns={campaigns}
                      stats={stats}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onViewDetails={handleViewDetails}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign) => {
                      const campaignStat = stats?.campaigns.find((c) => c.id === campaign.id);
                      const leadCount = campaignStat?.leadCount ?? (campaignStat as any)?._count?.leads ?? 0;
                      const conversions = campaignStat?.conversions ?? 0;
                      const cStats = {
                        leadCount,
                        conversionRate: leadCount > 0 ? (conversions / leadCount) * 100 : 0,
                        revenue: campaignStat?.revenue ?? 0,
                      };
                      return (
                        <CampaignStatsCard
                          key={campaign.id}
                          campaign={campaign}
                          stats={cStats}
                          onClick={() => handleViewDetails(campaign)}
                        />
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <Target className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-semibold text-neutral-900">No campaigns</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    Get started by creating a new marketing campaign.
                  </p>
                  <div className="mt-6">
                    <Button
                      onClick={handleCreateNew}
                      className="bg-[#16A34A] text-white hover:bg-[#16A34A]/90"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Campaign
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Dropped Checkouts Section */
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] border border-neutral-200/40 p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-[#0F172A]">Dropped Checkout Leads</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Track and convert users who initiated stock checkouts but dropped off during payment
                </p>
              </div>

              <DroppedCheckoutsTable
                items={droppedResponse?.data || []}
                summary={droppedResponse?.summary}
                isLoading={droppedLoading}
              />
            </div>
          </div>
        )}

        {/* Dialogs */}
        <CreateCampaignDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          campaignToEdit={selectedCampaign}
        />
        
        <DeleteCampaignDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          campaign={selectedCampaign}
        />

        <CampaignDetailsDrawer
          open={detailsDrawerOpen}
          onOpenChange={setDetailsDrawerOpen}
          campaign={selectedCampaign}
          stats={stats}
        />
      </div>
    </MarketingLayout>
  );
}

