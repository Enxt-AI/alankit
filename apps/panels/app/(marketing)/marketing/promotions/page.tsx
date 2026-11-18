'use client';

import React, { useState, useMemo } from 'react';
import {
  Ticket,
  Search,
  Copy,
  Check,
  Percent,
  IndianRupee,
  Loader2,
  Eye,
  TrendingUp,
  BarChart3,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Filter,
  Zap,
  Infinity,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MarketingLayout from '@/components/marketing/marketing-layout';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { useAdminCoupons } from '@/hooks/use-promotions';
import { Coupon } from '@/lib/promotions-api';
import { CouponDetailDialog } from '@/components/admin/promotions/coupon-detail-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CouponSalesPopupContent } from '@/components/admin/promotions/coupon-sales-popup-content';

export default function MarketingPromotionsPage() {
  const { marketingAdmin, isMarketingLoading } = useMarketingAuth();
  const { data: coupons = [], isLoading, isFetching, refetch } = useAdminCoupons('marketing');

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'REDEEMED' | 'EXPIRED'>('ALL');
  const [audienceFilter, setAudienceFilter] = useState<'ALL' | 'PUBLIC' | 'ASSIGNED'>('ALL');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'ALL' | 'FIXED' | 'PERCENTAGE'>('ALL');

  // Interactive UI states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCouponForDetail, setSelectedCouponForDetail] = useState<Coupon | null>(null);
  const [selectedSalesCouponId, setSelectedSalesCouponId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Handle copying code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Open detailed sales & redemption pop-up window or modal dialog
  const openCouponSalesPopup = (couponId: string) => {
    let popupOpened = false;
    try {
      const popup = window.open(
        `/marketing/promotions/sales-popup?id=${couponId}`,
        `coupon_sales_${couponId}`,
        'width=1200,height=900,status=no,menubar=no,resizable=yes,scrollbars=yes'
      );
      if (popup && !popup.closed && typeof popup.closed !== 'undefined') {
        popupOpened = true;
        popup.focus();
      }
    } catch (e) {
      console.warn('Popup blocked or error opening popup window:', e);
    }

    // If popup was blocked by browser or failed, immediately open the in-page modal dialog
    if (!popupOpened) {
      setSelectedSalesCouponId(couponId);
    }
  };

  // Strictly isolate Admin promotional coupons from RM referral coupons and ensure they are mapped to marketing
  const adminCoupons = useMemo(() => {
    return coupons.filter(
      (coupon) =>
        !coupon.internalRmId &&
        !coupon.distributorRmId &&
        !!coupon.createdBy &&
        coupon.mapToMarketing === true
    );
  }, [coupons]);

  // Calculate platform promotion metrics
  const stats = useMemo(() => {
    const now = new Date();
    let total = adminCoupons.length;
    let active = 0;
    let redeemed = 0;
    let totalDiscountDelivered = 0;

    adminCoupons.forEach((coupon) => {
      const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
      const count = coupon.redemptionCount || (coupon.isUsed ? 1 : 0);
      redeemed += count;
      if (!isExpired) active += 1;

      if (coupon.discountType === 'FIXED') {
        totalDiscountDelivered += count * coupon.discountAmount;
      } else if (coupon.orders && coupon.orders.length > 0) {
        coupon.orders.forEach((ord) => {
          totalDiscountDelivered += ord.discountApplied || 0;
        });
      } else if (coupon.order?.discountApplied) {
        totalDiscountDelivered += coupon.order.discountApplied;
      }
    });

    return { total, active, redeemed, totalDiscountDelivered };
  }, [adminCoupons]);

  // Filtered coupons based on user selection
  const filteredCoupons = useMemo(() => {
    return adminCoupons.filter((coupon) => {
      const now = new Date();
      const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;

      // Status filter
      if (statusFilter === 'AVAILABLE' && (isExpired || (coupon.redemptionCount && coupon.redemptionCount > 0))) return false;
      if (statusFilter === 'REDEEMED' && (!coupon.redemptionCount || coupon.redemptionCount === 0) && !coupon.isUsed) return false;
      if (statusFilter === 'EXPIRED' && !isExpired) return false;

      // Audience filter
      if (audienceFilter === 'PUBLIC' && coupon.assignedUserId) return false;
      if (audienceFilter === 'ASSIGNED' && !coupon.assignedUserId) return false;

      // Discount type filter
      if (discountTypeFilter === 'FIXED' && coupon.discountType !== 'FIXED') return false;
      if (discountTypeFilter === 'PERCENTAGE' && coupon.discountType !== 'PERCENTAGE') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = coupon.code.toLowerCase().includes(q);
        const stockMatch = (coupon.stock?.name || '').toLowerCase().includes(q);
        const userMatch =
          (coupon.assignedUser?.fullName || '').toLowerCase().includes(q) ||
          (coupon.assignedUser?.email || '').toLowerCase().includes(q) ||
          (coupon.usedByUser?.fullName || '').toLowerCase().includes(q);
        const creatorMatch =
          (coupon.createdBy?.name || '').toLowerCase().includes(q) ||
          (coupon.createdBy?.email || '').toLowerCase().includes(q) ||
          (coupon.createdBy?.role || '').toLowerCase().includes(q);

        if (!codeMatch && !stockMatch && !userMatch && !creatorMatch) return false;
      }

      return true;
    });
  }, [adminCoupons, statusFilter, audienceFilter, discountTypeFilter, searchQuery]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / itemsPerPage));
  const paginatedCoupons = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCoupons.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCoupons, currentPage]);

  return (
    <MarketingLayout>
      <TooltipProvider delayDuration={150}>
        <div className="mx-auto max-w-7xl space-y-6 py-6 px-4 sm:px-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#16A34A] border border-[#16A34A]/20">
                  <Ticket className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Promotions & Redemptions</h1>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                      Marketing View
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-[#64748B] mt-0.5">
                    View generated coupons, Super Admin creators, and click any coupon to inspect live sales & redemptions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-xl text-xs font-semibold h-9 border-neutral-200 hover:bg-[#F8FAFC] text-[#475569] cursor-pointer"
              >
                {isFetching && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-[#16A34A]" />}
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Marketing Panel Scope Info Banner */}
          <div className="flex items-center gap-2.5 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-blue-900 shadow-sm">
            <div className="h-7 w-7 rounded-xl bg-blue-100/90 text-blue-700 flex items-center justify-center shrink-0">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <span className="font-bold text-blue-950">Marketing Campaign Scope:</span>{' '}
              <span className="text-blue-800">
                Displaying only promotional coupons mapped by Super Admin to the Marketing Panel. Click on any coupon row to view full redemption orders, client claim history, and performance stats.
              </span>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Total Coupons */}
            <div
              className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
              style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
            >
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Coupons</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Ticket className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#0F172A] tracking-tight leading-none">{stats.total}</p>
              <p className="text-[11px] font-medium text-[#64748B] mt-1.5">Across all platform stocks</p>
            </div>

            {/* Active Coupons */}
            <div
              className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
              style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
            >
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Codes</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#16A34A] tracking-tight leading-none">{stats.active}</p>
              <p className="text-[11px] font-medium text-[#64748B] mt-1.5">Valid and unexpired</p>
            </div>

            {/* Redemptions */}
            <div
              className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
              style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
            >
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Redemptions</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <BarChart3 className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-purple-600 tracking-tight leading-none">{stats.redeemed}</p>
              <p className="text-[11px] font-medium text-[#64748B] mt-1.5">Claimed by platform clients</p>
            </div>

            {/* Total Discount Delivered */}
            <div
              className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
              style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
            >
              <div className="flex items-center justify-between text-[#64748B] mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Discounts Given</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <IndianRupee className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-[#0F172A] tracking-tight leading-none">
                ₹{Math.round(stats.totalDiscountDelivered).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] font-medium text-[#64748B] mt-1.5">Customer promotional savings</p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200/60 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Search code, stock, Super Admin creator, or client..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 text-xs rounded-xl border-neutral-200 focus:border-[#16A34A] focus:ring-[#16A34A]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-neutral-200/60 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-semibold text-[#64748B]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="REDEEMED">Redeemed</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              {/* Audience Filter */}
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-neutral-200/60 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-semibold text-[#64748B]">Audience:</span>
                <select
                  value={audienceFilter}
                  onChange={(e) => {
                    setAudienceFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Audiences</option>
                  <option value="PUBLIC">Multi-User Public</option>
                  <option value="ASSIGNED">Direct User Only</option>
                </select>
              </div>

              {/* Discount Type */}
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-neutral-200/60 rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-semibold text-[#64748B]">Type:</span>
                <select
                  value={discountTypeFilter}
                  onChange={(e) => {
                    setDiscountTypeFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Types</option>
                  <option value="FIXED">Flat Amount (₹)</option>
                  <option value="PERCENTAGE">Percentage (%)</option>
                </select>
              </div>

              {(searchQuery || statusFilter !== 'ALL' || audienceFilter !== 'ALL' || discountTypeFilter !== 'ALL') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setAudienceFilter('ALL');
                    setDiscountTypeFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="h-7 text-xs text-[#DC2626] hover:bg-red-50 px-2 font-medium"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Read-Only Guidance Note */}
          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0 font-bold text-[10px]">
                i
              </span>
              <span>
                <strong>Marketing Overview:</strong> Click any coupon row or the <strong>Sales Pop-up</strong> icon to launch the detailed redemption report and sales figures for that promotion.
              </span>
            </div>
          </div>

          {/* Coupons Table */}
          {/* Coupons Table */}
          <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
            <Table className="min-w-[1280px] w-full">
              <TableHeader className="bg-[#F9FAFB]">
                <TableRow className="border-b border-neutral-200/60">
                  <TableHead className="w-[50px] min-w-[50px] text-center font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 pl-4 pr-2 border-r border-[#E5E7EB] whitespace-nowrap">
                    S.No
                  </TableHead>
                  <TableHead className="min-w-[200px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap">
                    Coupon Code
                  </TableHead>
                  <TableHead className="min-w-[260px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap">
                    Stock Target
                  </TableHead>
                  <TableHead className="min-w-[130px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                    Discount
                  </TableHead>
                  <TableHead className="min-w-[150px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                    Qty Limits
                  </TableHead>
                  <TableHead className="min-w-[200px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap">
                    Created By
                  </TableHead>
                  <TableHead className="min-w-[160px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                    Audience
                  </TableHead>
                  <TableHead className="min-w-[130px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                    Status
                  </TableHead>
                  <TableHead className="min-w-[160px] font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right py-3.5 pr-4 whitespace-nowrap">
                    Sales & Details
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={9} className="py-4 text-center text-xs text-[#94A3B8]">
                        Loading promotions data...
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedCoupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-[#94A3B8]">
                          <Ticket className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold text-[#0F172A]">No promotional coupons found</p>
                        <p className="text-xs text-[#64748B]">
                          {searchQuery || statusFilter !== 'ALL'
                            ? 'Try adjusting your search criteria or clearing filters.'
                            : 'No promotional coupons have been created yet.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCoupons.map((coupon, idx) => {
                    const now = new Date();
                    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
                    const isDirectAdmin = !coupon.internalRmId && !coupon.distributorRmId;

                    return (
                      <TableRow
                        key={coupon.id}
                        onClick={() => openCouponSalesPopup(coupon.id)}
                        className="border-b border-neutral-100 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      >
                        {/* S.No */}
                        <TableCell className="pl-4 pr-2 py-3.5 font-semibold text-xs text-[#64748B] tabular-nums text-center whitespace-nowrap">
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </TableCell>

                        {/* Code */}
                        <TableCell className="px-4 py-3.5 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCouponSalesPopup(coupon.id);
                                  }}
                                  className="font-mono font-extrabold text-xs text-[#0F172A] bg-[#F1F5F9] hover:bg-emerald-50 hover:text-emerald-700 px-2.5 py-1.5 rounded-lg border border-neutral-200/60 tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <span>{coupon.code}</span>
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px] font-semibold">
                                Open sales & redemption report
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCode(coupon.code);
                                  }}
                                  className="h-6 w-6 rounded-md hover:bg-[#ECFDF5] flex items-center justify-center text-[#64748B] hover:text-[#16A34A] transition-colors cursor-pointer shrink-0"
                                >
                                  {copiedCode === coupon.code ? (
                                    <Check className="h-3 w-3 text-[#16A34A]" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px] font-semibold">
                                Copy coupon code
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>

                        {/* Stock */}
                        <TableCell className="px-4 py-3.5 whitespace-nowrap">
                          <div className="min-w-[220px]">
                            <p className="text-xs font-bold text-[#0F172A] whitespace-nowrap">{coupon.stock?.name || 'Stock'}</p>
                            <p className="text-[11px] font-medium text-[#64748B] whitespace-nowrap mt-0.5">
                              ₹{(coupon.stock?.price || 0).toLocaleString('en-IN')} / sh
                            </p>
                          </div>
                        </TableCell>

                        {/* Discount */}
                        <TableCell className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center font-extrabold text-xs text-[#16A34A] bg-[#DCFCE7]/60 px-2.5 py-1 rounded-md border border-[#16A34A]/20 whitespace-nowrap">
                            {coupon.discountType === 'PERCENTAGE' && coupon.discountPercentage
                              ? `${coupon.discountPercentage}% OFF`
                              : `₹${(coupon.discountAmount || 0).toLocaleString('en-IN')} / sh`}
                          </span>
                        </TableCell>

                        {/* Qty Limits */}
                        <TableCell className="px-4 py-3.5 text-center whitespace-nowrap text-xs text-[#475569]">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 rounded-lg border border-neutral-200/60 whitespace-nowrap">
                            <span>{coupon.minQuantity}</span>
                            <span className="text-[#94A3B8] mx-0.5">-</span>
                            <span>{coupon.maxQuantity >= 999999 ? '∞' : coupon.maxQuantity}</span>
                            <span className="text-[10px] text-[#64748B] ml-1">shares</span>
                          </span>
                        </TableCell>

                        {/* Created By */}
                        <TableCell className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-[11px] space-y-0.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                              <span className="font-bold text-[#0F172A] whitespace-nowrap">
                                {coupon.createdBy?.name || 'Super Admin'}
                              </span>
                              <Badge className="px-1.5 py-0 text-[9px] font-extrabold bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap shrink-0">
                                {coupon.createdBy?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : (coupon.createdBy?.role || 'ADMIN')}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-[#64748B] whitespace-nowrap" title={coupon.createdBy?.email || 'admin@smc.com'}>
                              {coupon.createdBy?.email || 'admin@smc.com'}
                            </p>
                          </div>
                        </TableCell>

                        {/* Audience */}
                        <TableCell className="px-4 py-3.5 text-center whitespace-nowrap text-xs">
                          {coupon.assignedUser ? (
                            <div className="space-y-1 inline-flex flex-col items-center whitespace-nowrap">
                              <span className="font-semibold text-blue-600 whitespace-nowrap" title={coupon.assignedUser.fullName || coupon.assignedUser.email || ''}>
                                {coupon.assignedUser.fullName || coupon.assignedUser.email}
                              </span>
                              <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[9px] whitespace-nowrap shrink-0">
                                <Zap className="h-2.5 w-2.5 text-amber-600" /> One-Time
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1 inline-flex flex-col items-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 text-[10px] whitespace-nowrap shrink-0">
                                Multi-User Public
                              </span>
                              <div>
                                {coupon.redemptionType === 'ONCE' ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px] whitespace-nowrap shrink-0">
                                    <Zap className="h-2.5 w-2.5 text-amber-600" /> One-Time
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[9px] whitespace-nowrap shrink-0">
                                    <Infinity className="h-2.5 w-2.5 text-purple-600" /> Unlimited
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-4 py-3.5 text-center whitespace-nowrap">
                          {isExpired ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold whitespace-nowrap">
                              Expired
                            </Badge>
                          ) : coupon.redemptionType === 'ONCE' && (coupon.isRedeemed || coupon.isUsed) ? (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-bold whitespace-nowrap">
                              Redeemed (1/1)
                            </Badge>
                          ) : (coupon.redemptionCount && coupon.redemptionCount > 0) ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold whitespace-nowrap">
                              Active ({coupon.redemptionCount} used)
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold whitespace-nowrap">
                              Available
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions (Read-Only) */}
                        <TableCell className="text-right pr-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* Sales Pop-up Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCouponSalesPopup(coupon.id);
                                  }}
                                  className="h-8 px-2.5 rounded-lg text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 hover:text-emerald-800 flex items-center gap-1.5 font-bold text-xs whitespace-nowrap"
                                >
                                  <BarChart3 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span>Sales</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-[10px] font-semibold text-emerald-700">
                                Open live sales & redemption pop-up report
                              </TooltipContent>
                            </Tooltip>

                            {/* View Details */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCouponForDetail(coupon);
                                  }}
                                  className="h-8 w-8 p-0 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100 shrink-0"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-[10px] font-semibold">
                                Inspect coupon details
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-[#F8FAFC]">
                <p className="text-xs text-[#64748B]">
                  Showing{' '}
                  <span className="font-semibold text-[#0F172A]">
                    {Math.min((currentPage - 1) * itemsPerPage + 1, filteredCoupons.length)}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-[#0F172A]">
                    {Math.min(currentPage * itemsPerPage, filteredCoupons.length)}
                  </span>{' '}
                  of <span className="font-semibold text-[#0F172A]">{filteredCoupons.length}</span> coupons
                </p>

                <Pagination className="justify-end w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={`h-8 text-xs cursor-pointer ${
                          currentPage === 1 ? 'pointer-events-none opacity-40' : ''
                        }`}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }).map((_, index) => {
                      const page = index + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="h-8 w-8 text-xs cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={`h-8 text-xs cursor-pointer ${
                          currentPage === totalPages ? 'pointer-events-none opacity-40' : ''
                        }`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>

        {/* Read-Only Coupon Detail Dialog */}
        <CouponDetailDialog
          coupon={selectedCouponForDetail}
          isOpen={!!selectedCouponForDetail}
          onClose={() => setSelectedCouponForDetail(null)}
        />

        {/* In-Page Live Sales & Redemption Modal (Resilient fallback for popup blockers) */}
        <Dialog
          open={!!selectedSalesCouponId}
          onOpenChange={(open) => {
            if (!open) setSelectedSalesCouponId(null);
          }}
        >
          <DialogContent className="max-w-6xl w-[95vw] p-0 overflow-hidden bg-white border border-neutral-200 shadow-2xl rounded-2xl">
            <DialogTitle className="sr-only">Coupon Sales & Redemption Performance</DialogTitle>
            {selectedSalesCouponId && (
              <CouponSalesPopupContent
                couponIdProp={selectedSalesCouponId}
                isModal={true}
                onClose={() => setSelectedSalesCouponId(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </MarketingLayout>
  );
}
