'use client';

import React, { useState, useMemo } from 'react';
import { notify } from '@/components/ui/floating-notification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { LeadFilters, MarketingCampaign } from '@/lib/marketing-api';

const KNOWN_SOURCES = ['FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'TWITTER'];

interface LeadFiltersProps {
  filters: LeadFilters;
  onFilterChange: (filters: LeadFilters) => void;
  campaigns: MarketingCampaign[];
  /** Distinct sources from the DB (includes SYSTEM/IMPORTED rows) */
  sources?: string[];
}

export default function LeadFiltersComponent({
  filters,
  onFilterChange,
  campaigns,
  sources = []
}: LeadFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<LeadFilters>(filters);

  // Union of known platforms + anything actually stored (SYSTEM, IMPORTED,
  // OTHER, …) so no real source is ever missing from the dropdown.
  const sourceOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_SOURCES);
    sources.forEach((s) => { if (s) set.add(s); });
    if (localFilters.source) set.add(localFilters.source);
    return Array.from(set).sort();
  }, [sources, localFilters.source]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof LeadFilters, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value === 'ALL' ? undefined : value || undefined }));
  };

  const handleApplyFilters = () => {
    if (localFilters.startDate && localFilters.endDate) {
      const startDate = new Date(localFilters.startDate);
      const endDate = new Date(localFilters.endDate);

      if (startDate > endDate) {
        notify.error('Start date cannot be after end date');
        return;
      }
    }

    if (localFilters.lastActivityFrom && localFilters.lastActivityTo) {
      const from = new Date(localFilters.lastActivityFrom);
      const to = new Date(localFilters.lastActivityTo);

      if (from > to) {
        notify.error('Last Activity From cannot be after Last Activity To');
        return;
      }
    }

    onFilterChange(localFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const clearedFilters: LeadFilters = {
      startDate: undefined,
      endDate: undefined,
      status: undefined,
      source: undefined,
      campaignId: undefined,
      search: undefined,
      lastActivityFrom: undefined,
      lastActivityTo: undefined,
      page: undefined,
      limit: undefined,
      kycStage: undefined,
      lastPaymentStatus: undefined,
      esignStage: undefined,
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
    setIsOpen(false);
  };

  const hasActiveFilters = !!(
    filters.startDate ||
    filters.endDate ||
    filters.status ||
    filters.source ||
    filters.campaignId ||
    filters.search ||
    filters.lastActivityFrom ||
    filters.lastActivityTo ||
    filters.kycStage ||
    filters.lastPaymentStatus ||
    filters.esignStage
  );

  return (
    <div className="w-full space-y-4">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition-all ${hasActiveFilters ? 'border-[#16A34A]/30 bg-[#ECFDF5] text-[#16A34A]' : 'border-neutral-200/60 bg-white text-[#64748B] hover:bg-[#ECFDF5]/50 hover:text-[#0F172A] hover:border-[#16A34A]/30'}`}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && <Badge className="ml-2 rounded-lg bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20 px-2 py-0 text-[11px] font-semibold hover:bg-[#ECFDF5]">{[filters.status, filters.source, filters.campaignId, filters.search, filters.startDate, filters.endDate, filters.kycStage, filters.lastPaymentStatus, filters.esignStage].filter(Boolean).length}</Badge>}
            {isOpen ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#ECFDF5] rounded-xl font-semibold transition-all duration-300"
            >
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Filter Panel */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <Card className="overflow-hidden bg-white rounded-[20px] border border-neutral-200/40" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
          <div className="p-6 pb-4 border-b border-neutral-200/40">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Search className="h-4 w-4 text-[#16A34A]" />
              Filter Leads
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status</Label>
                <Select
                  value={localFilters.status || 'ALL'}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="CONTACTED">CONTACTED</SelectItem>
                    <SelectItem value="QUALIFIED">QUALIFIED</SelectItem>
                    <SelectItem value="CONVERTED">CONVERTED</SelectItem>
                    <SelectItem value="LOST">LOST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* KYC + Payment Status Filters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kycStage" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">KYC Status</Label>
                  <Select
                    value={localFilters.kycStage || 'ALL'}
                    onValueChange={(value) => handleFilterChange('kycStage', value)}
                  >
                    <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                      <SelectValue placeholder="All KYC statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All KYC statuses</SelectItem>
                      <SelectItem value="NOT_INITIATED">Not Initiated</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="NOT_VERIFIED">Not Verified</SelectItem>
                      <SelectItem value="VERIFIED">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastPaymentStatus" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Last Payment Status</Label>
                  <Select
                    value={localFilters.lastPaymentStatus || 'ALL'}
                    onValueChange={(value) => handleFilterChange('lastPaymentStatus', value)}
                  >
                    <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                      <SelectValue placeholder="All payment statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All payment statuses</SelectItem>
                      <SelectItem value="NA">NA</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="NO_TRANSACTION">No Transaction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dropped at esign Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="esignStage" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Dropped at esign</Label>
                <Select
                  value={localFilters.esignStage || 'ALL'}
                  onValueChange={(value) => handleFilterChange('esignStage', value)}
                >
                  <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                    <SelectValue placeholder="All esign stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All esign stages</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="NOT_COMPLETED">Not completed</SelectItem>
                    <SelectItem value="NONE">— (never initiated)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="search" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Search</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={localFilters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] placeholder-[#64748B]/60 focus-visible:ring-2 focus-visible:ring-[#16A34A]/20 focus-visible:ring-offset-0 focus-visible:border-[#16A34A]"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Start Date</Label>
                  <DatePicker
                    value={localFilters.startDate || ''}
                    onChange={(val) => handleFilterChange('startDate', val)}
                    className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">End Date</Label>
                  <DatePicker
                    value={localFilters.endDate || ''}
                    onChange={(val) => handleFilterChange('endDate', val)}
                    className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                  />
                </div>
              </div>

              {/* Last Activity Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lastActivityFrom" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Last Activity From</Label>
                  <DatePicker
                    value={localFilters.lastActivityFrom || ''}
                    onChange={(val) => handleFilterChange('lastActivityFrom', val)}
                    className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastActivityTo" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Last Activity To</Label>
                  <DatePicker
                    value={localFilters.lastActivityTo || ''}
                    onChange={(val) => handleFilterChange('lastActivityTo', val)}
                    className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Source Filter */}
                <div className="space-y-1.5">
                  <Label htmlFor="source" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Source</Label>
                  <Select
                    value={localFilters.source || 'ALL'}
                    onValueChange={(value) => handleFilterChange('source', value)}
                  >
                    <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All sources</SelectItem>
                      {sourceOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campaign Filter */}
                <div className="space-y-1.5">
                  <Label htmlFor="campaignId" className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Campaign</Label>
                  <Select
                    value={localFilters.campaignId || 'ALL'}
                    onValueChange={(value) => handleFilterChange('campaignId', value)}
                  >
                    <SelectTrigger className="rounded-[14px] border border-neutral-200/60 bg-white text-sm h-10 text-[#0F172A] focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]">
                      <SelectValue placeholder="All campaigns" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All campaigns</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />
            <div className="flex gap-3 pt-1">
              <Button onClick={handleApplyFilters} className="h-10 flex-1 rounded-lg font-semibold bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] transition-all">
                Apply Filters
              </Button>
              <Button variant="outline" onClick={handleClearFilters} className="h-10 flex-1 rounded-lg font-semibold">
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
