'use client';

import { useState } from 'react';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useMarketingReportStats } from '@/hooks/use-marketing-stats';
import MarketingLayout from '@/components/marketing/marketing-layout';
import MarketingCharts from '@/components/marketing/marketing-charts';
import TopStocksReport from '@/components/marketing/top-stocks-report';
import { BarChart3, Download, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { notify } from '@/components/ui/floating-notification';

export default function MarketingReportsPage() {
  const { marketingAdmin, isMarketingLoading } = useMarketingAuth();
  
  // Date filters - default to last 30 days
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Queries
  const { 
    data: stats, 
    isLoading, 
    error,
    refetch
  } = useMarketingReportStats({ startDate, endDate });

  // Reports access: SUPER_ADMIN, or users with marketing_reports_view or marketing_view permission
  const canView = marketingAdmin?.role === 'SUPER_ADMIN' || 
    marketingAdmin?.permissions?.includes('marketing_reports_view');
  const canExport = marketingAdmin?.role === 'SUPER_ADMIN' || 
    marketingAdmin?.permissions?.includes('marketing_export');

  const handleExportCSV = () => {
    if (!stats) return;
    
    try {
      const exportData = stats.topCampaigns.map(c => ({
        'Campaign Name': c.name,
        'Platform': c.platform,
        'Status': c.status,
        'Leads': c.leadCount,
        'Conversions': c.conversions,
        'Conversion Rate (%)': c.conversionRate.toFixed(2),
        'Revenue (INR)': c.revenue,
        'Budget (INR)': c.budget || 0,
        'Cost Per Lead': c.budget && c.leadCount > 0 ? (c.budget / c.leadCount).toFixed(2) : 0
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `marketing-reports-${startDate}-to-${endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify.success('Report exported to CSV successfully');
    } catch (error) {
      console.error('Export failed:', error);
      notify.error('Failed to export report');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <MarketingLayout>
        <div className="max-w-7xl mx-auto space-y-8 p-6">
          <Alert className="border-red-200 bg-red-50 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load reports data.
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
              You do not have permission to view data within the Marketing module.
            </p>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-7xl space-y-6 py-2 pb-12 px-4 sm:px-6 lg:px-8 mt-6 print:m-0 print:p-0 print:max-w-none">
        {/* Header - hide in print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              Marketing Reports
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Analyze campaign performance and lead generation metrics
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm">
              <CalendarIcon className="h-4 w-4 text-neutral-500" />
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 border-none focus-visible:ring-0 p-0 text-sm w-32 bg-transparent"
              />
              <span className="text-neutral-300">-</span>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 border-none focus-visible:ring-0 p-0 text-sm w-32 bg-transparent"
              />
            </div>
            
            {canExport && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={isLoading || !stats?.topCampaigns?.length}
                  className="font-medium h-10 border-neutral-200 text-neutral-700 bg-white hover:bg-neutral-50 shadow-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  disabled={isLoading}
                  className="font-medium h-10 border-neutral-200 text-neutral-700 bg-white hover:bg-neutral-50 shadow-sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print / PDF
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Print Header - only show in print */}
        <div className="hidden print:block mb-8">
          <h1 className="text-2xl font-bold text-black">Marketing Performance Report</h1>
          <p className="text-gray-500">Period: {startDate} to {endDate}</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-[20px] border border-neutral-200/40 p-6 h-[120px]">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : stats && (
            <>
              <div className="bg-white rounded-[20px] border border-neutral-200/40 p-6 shadow-sm print:break-inside-avoid">
                <p className="text-sm font-semibold text-neutral-500">Period Leads</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.monthlyPerformance.leads}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">Total leads generated</p>
              </div>
              <div className="bg-white rounded-[20px] border border-neutral-200/40 p-6 shadow-sm print:break-inside-avoid">
                <p className="text-sm font-semibold text-neutral-500">Period Conversions</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.monthlyPerformance.conversions}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">Successfully converted</p>
              </div>
              <div className="bg-white rounded-[20px] border border-neutral-200/40 p-6 shadow-sm print:break-inside-avoid">
                <p className="text-sm font-semibold text-neutral-500">Conversion Rate</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">{stats.monthlyPerformance.conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-purple-600 font-medium mt-1">Lead to conversion ratio</p>
              </div>
              <div className="bg-white rounded-[20px] border border-neutral-200/40 p-6 shadow-sm print:break-inside-avoid">
                <p className="text-sm font-semibold text-neutral-500">Period Revenue</p>
                <p className="text-3xl font-bold text-neutral-900 mt-2">₹{stats.monthlyPerformance.revenue.toLocaleString()}</p>
                <p className="text-xs text-amber-600 font-medium mt-1">From conversions</p>
              </div>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="print:mt-8">
          <MarketingCharts 
            stats={stats} 
            isLoading={isLoading} 
            error={error} 
            onRetry={refetch} 
          />
        </div>
        
        {/* Top Stocks Report */}
        <div className="print:mt-8">
          <TopStocksReport />
        </div>
        
        {/* Top Campaigns Table */}
        {!isLoading && stats && stats.topCampaigns.length > 0 && (
          <div className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden shadow-sm mt-8 print:break-before-page">
            <div className="px-6 py-5 border-b border-neutral-200/40 bg-neutral-50/50">
              <h3 className="text-base font-bold text-neutral-900">Top Performing Campaigns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-neutral-500 uppercase bg-neutral-50/50 border-b border-neutral-200/40">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Campaign</th>
                    <th className="px-6 py-4 font-semibold">Platform</th>
                    <th className="px-6 py-4 font-semibold text-right">Leads</th>
                    <th className="px-6 py-4 font-semibold text-right">Conversions</th>
                    <th className="px-6 py-4 font-semibold text-right">Conv. Rate</th>
                    <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/40">
                  {stats.topCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{campaign.name}</td>
                      <td className="px-6 py-4 text-neutral-600">{campaign.platform}</td>
                      <td className="px-6 py-4 font-medium text-neutral-900 text-right">{campaign.leadCount}</td>
                      <td className="px-6 py-4 font-medium text-emerald-600 text-right">{campaign.conversions}</td>
                      <td className="px-6 py-4 font-medium text-neutral-900 text-right">{campaign.conversionRate.toFixed(1)}%</td>
                      <td className="px-6 py-4 font-medium text-neutral-900 text-right">₹{campaign.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


      </div>
    </MarketingLayout>
  );
}
