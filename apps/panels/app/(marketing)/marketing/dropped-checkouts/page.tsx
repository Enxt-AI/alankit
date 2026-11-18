'use client';

import { useState, useMemo } from 'react';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useDroppedCheckouts, useEsignDropouts } from '@/hooks/use-marketing-stats';
import MarketingLayout from '@/components/marketing/marketing-layout';
import DroppedCheckoutsTable from '@/components/marketing/dropped-checkouts-table';
import EsignDropoutsTable from '@/components/marketing/esign-dropouts-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { AlertCircle, ShoppingBag, FileSignature, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DroppedCheckoutsPage() {
  const { marketingAdmin, isMarketingLoading } = useMarketingAuth();
  const [activeTab, setActiveTab] = useState<'payment' | 'esign'>('payment');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Server-side date filter (backend supports startDate/endDate on both
  // endpoints). Invalid ranges are ignored with an inline hint.
  const dateRangeValid = !startDate || !endDate || startDate <= endDate;
  const dateFilters = useMemo(() => ({
    startDate: dateRangeValid && startDate ? startDate : undefined,
    endDate: dateRangeValid && endDate ? endDate : undefined,
    limit: 100,
  }), [startDate, endDate, dateRangeValid]);
  const { data: droppedResponse, isLoading, error } = useDroppedCheckouts(dateFilters);
  const { data: esignResponse, isLoading: esignLoading, error: esignError } = useEsignDropouts(dateFilters);

  const canView =
    marketingAdmin?.role === 'SUPER_ADMIN' ||
    marketingAdmin?.permissions?.includes('marketing_view');

  if (error && esignError) {
    return (
      <MarketingLayout>
        <div className="max-w-7xl mx-auto space-y-8 p-6">
          <Alert className="border-red-200 bg-red-50 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load dropped checkouts data. Please try refreshing.
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
              You do not have permission to view dropped checkouts. Please contact your administrator.
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
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
                Dropped Checkouts
              </h1>
            </div>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              Identify and re-engage users who dropped out during payment or e-sign
            </p>
          </div>
          {/* Date range filter (applies to both tabs, server-side) */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">From</span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="h-10 w-full sm:w-44 rounded-xl border border-neutral-200/60 bg-white text-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">To</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className="h-10 w-full sm:w-44 rounded-xl border border-neutral-200/60 bg-white text-sm"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="h-10 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#ECFDF5]"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear dates
              </Button>
            )}
          </div>
        </div>
        {!dateRangeValid && (
          <p className="text-xs font-semibold text-red-600">Start date cannot be after end date — date filter ignored.</p>
        )}

        {/* Payment vs E-sign tabs — admin TabsList pattern */}
        <div className="inline-flex items-center gap-1 h-[38px] rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1">
          <button
            onClick={() => setActiveTab('payment')}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all flex items-center gap-2 ${activeTab === 'payment' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            <ShoppingBag className="h-4 w-4" />
            Payment dropouts
            {droppedResponse?.summary?.totalDroppedCount ? (
              <span className="ml-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                {droppedResponse.summary.totalDroppedCount}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('esign')}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all flex items-center gap-2 ${activeTab === 'esign' ? 'bg-white text-[#16A34A] shadow-[0_2px_8px_rgba(15,23,42,0.08)]' : 'text-[#64748B] hover:text-[#0F172A]'}`}
          >
            <FileSignature className="h-4 w-4" />
            E-sign dropouts
            {esignResponse?.summary?.totalEsignDropouts ? (
              <span className="ml-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20">
                {esignResponse.summary.totalEsignDropouts}
              </span>
            ) : null}
          </button>
        </div>

        {activeTab === 'payment' ? (
          <DroppedCheckoutsTable
            items={droppedResponse?.data || []}
            summary={droppedResponse?.summary}
            isLoading={isLoading}
          />
        ) : (
          <EsignDropoutsTable
            items={esignResponse?.data || []}
            summary={esignResponse?.summary}
            isLoading={esignLoading}
          />
        )}
      </div>
    </MarketingLayout>
  );
}
