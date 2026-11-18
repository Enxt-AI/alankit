'use client';

import React, { useState, useMemo } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Copy,
  Check,
  Percent,
  IndianRupee,
  Calendar,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Loader2,
  Eye,
  Trash2,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Tag,
  Filter,
  BarChart3,
  ExternalLink,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useAdminCoupons,
  useDeleteCouponMutation,
  useToggleMarketingMappingMutation,
} from '@/hooks/use-promotions';
import { Coupon } from '@/lib/promotions-api';
import { CreateCouponDialog } from '@/components/admin/promotions/create-coupon-dialog';
import { CouponDetailDialog } from '@/components/admin/promotions/coupon-detail-dialog';
import { notify } from '@/components/ui/floating-notification';
import { format } from 'date-fns';

export default function AdminPromotionsPage() {
  const { data: coupons = [], isLoading, isFetching, refetch } = useAdminCoupons('admin');
  const deleteMutation = useDeleteCouponMutation();
  const toggleMappingMutation = useToggleMarketingMappingMutation();

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'REDEEMED' | 'EXPIRED'>('ALL');
  const [audienceFilter, setAudienceFilter] = useState<'ALL' | 'PUBLIC' | 'ASSIGNED'>('ALL');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'ALL' | 'FIXED' | 'PERCENTAGE'>('ALL');
  const [marketingFilter, setMarketingFilter] = useState<'ALL' | 'MAPPED' | 'ADMIN_ONLY'>('ALL');

  // Modals & Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCouponForDetail, setSelectedCouponForDetail] = useState<Coupon | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    notify.success(`Coupon code ${code} copied to clipboard!`);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const openCouponSalesPopup = (couponId: string) => {
    window.open(
      `/admin/promotions/sales-popup?id=${couponId}`,
      `coupon_sales_${couponId}`,
      'width=1200,height=900,status=no,menubar=no,resizable=yes,scrollbars=yes'
    );
  };

  // Confirm delete handler (for unredeemed coupons)
  const confirmDelete = async () => {
    if (!couponToDelete) return;
    if (couponToDelete.isUsed) {
      notify.error('Cannot delete a redeemed coupon. Redeemed coupons are permanently immutable.');
      setCouponToDelete(null);
      return;
    }

    try {
      await deleteMutation.mutateAsync(couponToDelete.id);
      notify.success(`Coupon ${couponToDelete.code} deleted successfully.`);
      setCouponToDelete(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete coupon.';
      notify.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  // Strictly isolate Admin promotional coupons from RM referral coupons
  const adminCoupons = useMemo(() => {
    return coupons.filter((coupon) => !coupon.internalRmId && !coupon.distributorRmId && !!coupon.createdBy);
  }, [coupons]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = adminCoupons.length;
    const now = new Date();
    let active = 0;
    let redeemed = 0;
    let totalDiscountDelivered = 0;

    adminCoupons.forEach((coupon) => {
      const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
      const count = coupon.redemptionCount || (coupon.isUsed ? 1 : 0);
      redeemed += count;
      if (!isExpired) active += 1;

      if (coupon.discountType === 'FIXED') {
        totalDiscountDelivered += count * (coupon.discountAmount || 0);
      } else if (coupon.orders && coupon.orders.length > 0) {
        coupon.orders.forEach((ord) => {
          totalDiscountDelivered += ord.discountApplied || 0;
        });
      } else if (coupon.order?.discountApplied) {
        totalDiscountDelivered += coupon.order.discountApplied;
      }
    });

    const available = adminCoupons.filter((c) => {
      const isExpired = c.expiresAt && new Date(c.expiresAt) < now;
      return !isExpired;
    }).length;

    const expired = adminCoupons.filter((c) => {
      return c.expiresAt && new Date(c.expiresAt) < now;
    }).length;

    return {
      total,
      available,
      redeemed,
      expired,
      redemptionRate: total > 0 ? ((redeemed / total) * 100).toFixed(1) : '0',
      totalDiscountDelivered,
    };
  }, [adminCoupons]);

  // Filtering Logic
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

      // Marketing visibility filter
      if (marketingFilter === 'MAPPED' && !coupon.mapToMarketing) return false;
      if (marketingFilter === 'ADMIN_ONLY' && coupon.mapToMarketing) return false;

      return true;
    });
  }, [adminCoupons, statusFilter, audienceFilter, discountTypeFilter, marketingFilter, searchQuery]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / itemsPerPage));
  const paginatedCoupons = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCoupons.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCoupons, currentPage]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-7xl space-y-6 py-4 px-2 sm:px-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#16A34A] border border-[#16A34A]/20">
                <Ticket className="h-4.5 w-4.5" />
              </span>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Promotions & Coupons</h1>
              <Badge className="bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/20 text-[11px] font-bold">
                Admin Control
              </Badge>
            </div>
            <p className="text-xs font-medium text-[#64748B] mt-1">
              Create, inspect, and monitor promotional codes across all unlisted stocks.
            </p>
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
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl text-xs font-bold h-9 bg-[#16A34A] hover:bg-[#15803D] text-white shadow-md shadow-[#16A34A]/20 px-4"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Coupon
            </Button>
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
            <p className="text-[11px] font-medium text-[#64748B] mt-2">
              <span className="text-[#16A34A] font-bold">{stats.total}</span> promotional codes
            </p>
          </div>

          {/* Active Available */}
          <div
            className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
            style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
          >
            <div className="flex items-center justify-between text-[#64748B] mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active & Available</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-[#16A34A] tracking-tight leading-none">{stats.available}</p>
            <p className="text-[11px] font-medium text-[#64748B] mt-2">Ready for customers to apply</p>
          </div>

          {/* Redeemed */}
          <div
            className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
            style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
          >
            <div className="flex items-center justify-between text-[#64748B] mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Redeemed</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <TrendingUp className="h-4 w-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-[#0F172A] tracking-tight leading-none">{stats.redeemed}</p>
            <p className="text-[11px] font-medium text-[#64748B] mt-2">
              <span className="font-bold text-purple-600">{stats.redemptionRate}%</span> redemption rate
            </p>
          </div>

          {/* Total Discount Delivered */}
          <div
            className="p-4 bg-white rounded-2xl border border-neutral-200/50 shadow-sm transition-all hover:shadow-md"
            style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.03)' }}
          >
            <div className="flex items-center justify-between text-[#64748B] mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Discount Delivered</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <IndianRupee className="h-4 w-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-[#0F172A] tracking-tight leading-none">
              ₹{stats.totalDiscountDelivered.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] font-medium text-[#64748B] mt-2">Total user savings delivered</p>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        <div className="p-4 bg-white rounded-2xl border border-neutral-200/60 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by coupon code, stock name, creator Super Admin, or user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 text-xs rounded-xl h-9 border-neutral-200"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['ALL', 'AVAILABLE', 'REDEEMED', 'EXPIRED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    statusFilter === status
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-200/60'
                  }`}
                >
                  {status === 'ALL'
                    ? 'All Status'
                    : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-xs">
            <span className="text-[#94A3B8] font-semibold flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filters:
            </span>

            {/* Audience Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[#64748B]">Audience:</span>
              <select
                value={audienceFilter}
                onChange={(e) => {
                  setAudienceFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 py-0 text-xs font-semibold rounded-lg bg-neutral-50 border border-neutral-200 text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Audiences</option>
                <option value="PUBLIC">Multi-User Public</option>
                <option value="ASSIGNED">Direct User Only</option>
              </select>
            </div>

            {/* Discount Type Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[#64748B]">Discount:</span>
              <select
                value={discountTypeFilter}
                onChange={(e) => {
                  setDiscountTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 py-0 text-xs font-semibold rounded-lg bg-neutral-50 border border-neutral-200 text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="FIXED">Flat Amount (₹)</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>

            {/* Marketing Visibility Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[#64748B]">Marketing:</span>
              <select
                value={marketingFilter}
                onChange={(e) => {
                  setMarketingFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 py-0 text-xs font-semibold rounded-lg bg-neutral-50 border border-neutral-200 text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Visibility</option>
                <option value="MAPPED">📢 Mapped to Marketing</option>
                <option value="ADMIN_ONLY">🔒 Admin Only</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== 'ALL' || audienceFilter !== 'ALL' || discountTypeFilter !== 'ALL' || marketingFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setAudienceFilter('ALL');
                  setDiscountTypeFilter('ALL');
                  setMarketingFilter('ALL');
                  setCurrentPage(1);
                }}
                className="h-7 text-xs text-[#DC2626] hover:bg-red-50 px-2 font-medium"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Coupons Table */}
        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
          <Table className="min-w-[1380px] w-full">
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
                  Marketing
                </TableHead>
                <TableHead className="min-w-[130px] font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3.5 px-4 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                  Status
                </TableHead>
                <TableHead className="min-w-[160px] font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right py-3.5 pr-4 whitespace-nowrap">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={10} className="py-4 text-center text-xs text-[#94A3B8]">
                      Loading promotions data...
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-[#94A3B8]">
                        <Ticket className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-bold text-[#0F172A]">No promotional coupons found</p>
                      <p className="text-xs text-[#64748B]">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or clearing filters.'
                          : 'Click "Create Coupon" above to generate your first promotion.'}
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

                      {/* Marketing Visibility */}
                      <TableCell className="px-4 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await toggleMappingMutation.mutateAsync({
                                id: coupon.id,
                                mapToMarketing: !coupon.mapToMarketing,
                              });
                              notify.success(
                                !coupon.mapToMarketing
                                  ? `Coupon ${coupon.code} mapped to Marketing Panel!`
                                  : `Coupon ${coupon.code} unmapped from Marketing Panel.`
                              );
                            } catch {
                              notify.error('Failed to update marketing mapping.');
                            }
                          }}
                          title={coupon.mapToMarketing ? 'Click to unmap from Marketing Panel' : 'Click to map to Marketing Panel'}
                          className="focus:outline-none whitespace-nowrap"
                        >
                          {coupon.mapToMarketing ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap">
                              <Megaphone className="h-2.5 w-2.5 text-blue-600" />
                              Mapped
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 text-[9px] font-medium inline-flex items-center gap-1 cursor-pointer transition-all whitespace-nowrap">
                              <Lock className="h-2.5 w-2.5 text-slate-400" />
                              Admin Only
                            </Badge>
                          )}
                        </button>
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

                      {/* Actions */}
                      <TableCell className="text-right pr-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Toggle Marketing Mapping Action */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await toggleMappingMutation.mutateAsync({
                                      id: coupon.id,
                                      mapToMarketing: !coupon.mapToMarketing,
                                    });
                                    notify.success(
                                      !coupon.mapToMarketing
                                        ? `Coupon ${coupon.code} mapped to Marketing Panel!`
                                        : `Coupon ${coupon.code} unmapped from Marketing Panel.`
                                    );
                                  } catch {
                                    notify.error('Failed to update marketing mapping.');
                                  }
                                }}
                                disabled={toggleMappingMutation.isPending}
                                className={`h-7 w-7 p-0 rounded-lg ${
                                  coupon.mapToMarketing
                                    ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <Megaphone className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px] font-semibold">
                              {coupon.mapToMarketing ? 'Unmap from Marketing Panel' : 'Map to Marketing Panel'}
                            </TooltipContent>
                          </Tooltip>

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
                                className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px] font-semibold text-emerald-700">
                              Open Sales Pop-up Report
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
                                className="h-7 w-7 p-0 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-neutral-100"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px] font-semibold">
                              Inspect Coupon Details
                            </TooltipContent>
                          </Tooltip>

                          {/* Delete: ONLY allowed if unredeemed */}
                          {(!coupon.isUsed && (!coupon.redemptionCount || coupon.redemptionCount === 0)) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCouponToDelete(coupon);
                                  }}
                                  className="h-7 w-7 p-0 rounded-lg text-[#DC2626] hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-[10px] font-semibold text-red-600">
                                Delete Unredeemed Coupon
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 w-7 flex items-center justify-center text-[#94A3B8] cursor-not-allowed"
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-[10px] font-semibold">
                                Redeemed coupons are immutable & cannot be deleted
                              </TooltipContent>
                            </Tooltip>
                          )}
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-[#FAFBFC]">
              <p className="text-xs text-[#64748B]">
                Showing <span className="font-semibold text-[#0F172A]">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-semibold text-[#0F172A]">
                  {Math.min(currentPage * itemsPerPage, filteredCoupons.length)}
                </span>{' '}
                of <span className="font-semibold text-[#0F172A]">{filteredCoupons.length}</span> coupons
              </p>

              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={`h-8 text-xs cursor-pointer ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <PaginationItem key={idx}>
                      <PaginationLink
                        onClick={() => setCurrentPage(idx + 1)}
                        isActive={currentPage === idx + 1}
                        className="h-8 w-8 text-xs cursor-pointer"
                      >
                        {idx + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={`h-8 text-xs cursor-pointer ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {/* Create Coupon Modal */}
        <CreateCouponDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => refetch()}
        />

        {/* View Details Modal */}
        <CouponDetailDialog
          coupon={selectedCouponForDetail}
          isOpen={!!selectedCouponForDetail}
          onClose={() => setSelectedCouponForDetail(null)}
        />

        {/* Delete Confirmation Alert Dialog (Unredeemed coupons only) */}
        <AlertDialog open={!!couponToDelete} onOpenChange={(open) => !open && setCouponToDelete(null)}>
          <AlertDialogContent className="rounded-2xl border-neutral-200">
            <AlertDialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <AlertCircle className="h-5 w-5" />
                <AlertDialogTitle className="text-base font-bold text-[#0F172A]">
                  Delete Coupon Code?
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-xs text-[#64748B] leading-relaxed">
                Are you sure you want to delete the unredeemed coupon{' '}
                <span className="font-mono font-bold text-[#0F172A]">{couponToDelete?.code}</span>? Once deleted,
                this code can no longer be used by customers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel className="rounded-xl text-xs font-semibold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
              >
                Delete Coupon
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
