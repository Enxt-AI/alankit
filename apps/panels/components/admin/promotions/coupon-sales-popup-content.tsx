'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Ticket,
  Search,
  Copy,
  CheckCircle2,
  Calendar,
  DollarSign,
  BarChart3,
  Loader2,
  Users,
  Layers,
  ArrowDownToLine,
  X,
  Clock,
  Sparkles,
  Percent,
  Check,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { getCouponById, getAllCoupons, Coupon, CouponOrder } from '@/lib/promotions-api';
import { format } from 'date-fns';

export interface CouponSalesPopupContentProps {
  couponIdProp?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export function CouponSalesPopupContent({
  couponIdProp,
  onClose,
  isModal = false,
}: CouponSalesPopupContentProps) {
  const searchParams = useSearchParams();
  const couponId = couponIdProp || searchParams?.get('id') || searchParams?.get('code') || null;

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [activeTab, setActiveTab] = useState<'REDEMPTIONS' | 'CUSTOMERS'>('REDEMPTIONS');

  // Clipboard feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (typeof window !== 'undefined') {
      window.close();
    }
  };

  const fetchData = async (showRefreshSpinner = false) => {
    if (!couponId) {
      setIsLoading(false);
      setErrorMessage('No coupon ID or code was specified.');
      return;
    }

    if (showRefreshSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      // 1. Try fetching specific coupon with full stats
      try {
        const singleCoupon = await getCouponById(couponId);
        if (singleCoupon && singleCoupon.id) {
          setCoupon(singleCoupon);
          return;
        }
      } catch (err) {
        console.warn('Direct coupon lookup failed, falling back to all coupons query:', err);
      }

      // 2. Fallback: fetch all coupons and match
      const allCoupons = await getAllCoupons();
      const matched = allCoupons.find(
        (c) => c.id === couponId || c.code?.toUpperCase() === couponId.toUpperCase()
      );

      if (matched) {
        setCoupon(matched);
      } else {
        setErrorMessage(`Coupon with ID or code "${couponId}" could not be found.`);
      }
    } catch (err: any) {
      console.error('Error fetching coupon sales popup data:', err);
      setErrorMessage('Failed to load sales information for this coupon. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [couponId]);

  const copyCouponCode = () => {
    if (!coupon?.code) return;
    navigator.clipboard.writeText(coupon.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyOrderId = (orderNum: string) => {
    navigator.clipboard.writeText(orderNum);
    setCopiedOrderId(orderNum);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Compile all orders linked to this coupon
  const allOrders: CouponOrder[] = useMemo(() => {
    if (!coupon) return [];
    const list: CouponOrder[] = [];

    // From coupon.orders array
    if (coupon.orders && Array.isArray(coupon.orders)) {
      list.push(...coupon.orders);
    }

    // From single order if not already in list
    if (coupon.order && !list.some((o) => o.id === coupon.order?.id)) {
      list.push({
        ...coupon.order,
        user: coupon.usedByUser || null,
        stock: coupon.stock ? { name: coupon.stock.name, price: coupon.stock.price } : null,
      });
    }

    return list;
  }, [coupon]);

  // Filtered Orders for the table
  const filteredOrders = useMemo(() => {
    return allOrders.filter((ord) => {
      // Status filter
      const isPaid = ['PAID', 'ALLOCATED', 'COMPLETED'].includes(ord.status || '');
      if (statusFilter === 'PAID' && !isPaid) return false;
      if (statusFilter === 'PENDING' && isPaid) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const orderNum = (ord.orderNumber || ord.id || '').toLowerCase();
      const clientName = (ord.user?.fullName || '').toLowerCase();
      const clientEmail = (ord.user?.email || '').toLowerCase();
      const clientPhone = (ord.user?.phone || '').toLowerCase();

      return (
        orderNum.includes(q) ||
        clientName.includes(q) ||
        clientEmail.includes(q) ||
        clientPhone.includes(q)
      );
    });
  }, [allOrders, searchQuery, statusFilter]);

  // Aggregated KPI Stats
  const metrics = useMemo(() => {
    const paidOrders = allOrders.filter((o) =>
      ['PAID', 'ALLOCATED', 'COMPLETED'].includes(o.status || '')
    );

    // Distinct users who claimed
    const uniqueUsersMap = new Map<string, { user: any; orderCount: number; totalShares: number; totalSpent: number }>();
    
    for (const ord of paidOrders) {
      const userKey = ord.user?.id || ord.user?.email || (ord as any).userId || 'unknown';
      if (!uniqueUsersMap.has(userKey)) {
        uniqueUsersMap.set(userKey, {
          user: ord.user || { fullName: 'Customer', email: userKey },
          orderCount: 0,
          totalShares: 0,
          totalSpent: 0,
        });
      }
      const existing = uniqueUsersMap.get(userKey)!;
      existing.orderCount += 1;
      existing.totalShares += ord.quantity || 0;
      existing.totalSpent += ord.totalAmount || 0;
    }

    const uniqueUsersCount = uniqueUsersMap.size;
    const totalRedemptions = paidOrders.length;
    const totalSharesSold = paidOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const totalGrossRevenue = paidOrders.reduce(
      (sum, o) => sum + (o.originalTotalAmount || ((o.pricePerShare || 0) * (o.quantity || 0)) || o.totalAmount || 0),
      0
    );
    const totalDiscountDisbursed = paidOrders.reduce((sum, o) => sum + (o.discountApplied || 0), 0);
    const totalNetSales = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const avgSharesPerOrder = totalRedemptions > 0 ? Math.round(totalSharesSold / totalRedemptions) : 0;
    const avgOrderValue = totalRedemptions > 0 ? Math.round(totalNetSales / totalRedemptions) : 0;

    return {
      totalRedemptions,
      allOrdersCount: allOrders.length,
      uniqueUsersCount,
      uniqueUsersList: Array.from(uniqueUsersMap.values()),
      totalSharesSold,
      totalGrossRevenue,
      totalDiscountDisbursed,
      totalNetSales,
      avgSharesPerOrder,
      avgOrderValue,
    };
  }, [allOrders]);

  // Export Redemptions to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'Order Number',
      'Customer Name',
      'Email',
      'Phone',
      'Stock Name',
      'Quantity',
      'Price Per Share (INR)',
      'Gross Amount (INR)',
      'Discount Applied (INR)',
      'Net Paid Amount (INR)',
      'Status',
      'Date',
    ];

    const rows = filteredOrders.map((ord) => [
      `"${ord.orderNumber || ord.id}"`,
      `"${ord.user?.fullName || 'Customer'}"`,
      `"${ord.user?.email || ''}"`,
      `"${ord.user?.phone || ''}"`,
      `"${coupon?.stock?.name || 'Stock'}"`,
      ord.quantity || 0,
      ord.pricePerShare || 0,
      ord.originalTotalAmount || ((ord.pricePerShare || 0) * (ord.quantity || 0)) || 0,
      ord.discountApplied || 0,
      ord.totalAmount || 0,
      `"${ord.status || 'PENDING'}"`,
      `"${ord.createdAt ? format(new Date(ord.createdAt), 'yyyy-MM-dd HH:mm:ss') : ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `coupon_sales_${coupon?.code || 'report'}_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className={`flex ${isModal ? 'py-20' : 'h-screen'} items-center justify-center bg-[#F8FAFC]`}>
        <div className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl shadow-sm border border-neutral-200">
          <Loader2 className="animate-spin h-9 w-9 text-[#16A34A]" />
          <p className="text-sm font-bold text-[#0F172A]">Loading coupon sales & redemption report...</p>
          <p className="text-xs text-[#64748B]">Aggregating live customer orders and redemption metrics</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !coupon) {
    return (
      <div className={`flex ${isModal ? 'py-16' : 'h-screen'} items-center justify-center bg-[#F8FAFC] p-6`}>
        <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A]">Coupon Not Found</h2>
          <p className="text-xs text-[#64748B] leading-relaxed">
            {errorMessage || 'Unable to retrieve promotional coupon sales data.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              className="text-xs font-semibold rounded-xl"
            >
              Retry Loading
            </Button>
            <Button
              size="sm"
              onClick={handleClose}
              className="text-xs font-semibold bg-[#0F172A] hover:bg-neutral-800 text-white rounded-xl"
            >
              {isModal ? 'Close' : 'Close Window'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isDirectAdmin = !coupon.internalRmId && !coupon.distributorRmId;
  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();

  return (
    <div className={isModal ? 'max-h-[85vh] overflow-y-auto p-4 md:p-6 space-y-6' : 'min-h-screen bg-[#FAFBFC] p-6 md:p-8 space-y-6 max-w-7xl mx-auto'}>
      {/* Top Navigation / Status Bar */}
      <div className="flex items-center justify-between bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">
                Coupon Sales & Redemption Performance
              </h1>
              <Badge className="bg-[#16A34A]/15 text-[#16A34A] border-[#16A34A]/25 text-[10px] font-bold">
                {isDirectAdmin ? 'Platform Admin Promotion' : 'RM Referral Code'}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">
              Real-time audit log of customer redemptions, claim volume, and sales conversion metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="h-8 text-xs font-semibold rounded-xl border-neutral-200 text-[#475569] hover:text-[#0F172A]"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
            className="h-8 text-xs font-semibold rounded-xl border-neutral-200 text-[#16A34A] hover:bg-emerald-50"
          >
            <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Coupon Identity Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white rounded-2xl p-6 shadow-md border border-neutral-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Code & Stock Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/15 backdrop-blur-sm flex items-center gap-2.5">
                <span className="font-mono text-2xl font-black tracking-widest text-[#4ADE80]">
                  {coupon.code}
                </span>
                <button
                  onClick={copyCouponCode}
                  className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 transition-colors"
                  title="Copy coupon code"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#4ADE80]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Status Pill */}
              {coupon.redemptionType === 'ONCE' ? (
                metrics.totalRedemptions > 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold px-3 py-1">
                    Redeemed & Burned (1/1)
                  </Badge>
                ) : isExpired ? (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-xs font-bold px-3 py-1">
                    Expired (Unredeemed)
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-bold px-3 py-1">
                    Available (One-Time)
                  </Badge>
                )
              ) : (
                metrics.totalRedemptions > 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold px-3 py-1">
                    Active ({metrics.totalRedemptions} {metrics.totalRedemptions === 1 ? 'sale' : 'sales'})
                  </Badge>
                ) : isExpired ? (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-xs font-bold px-3 py-1">
                    Expired (Unredeemed)
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-bold px-3 py-1">
                    Active (Unlimited Uses)
                  </Badge>
                )
              )}

              {/* Multi-User / Redemption Type */}
              <Badge className="bg-white/10 text-white/90 border-white/15 text-xs font-medium px-3 py-1">
                {isDirectAdmin
                  ? coupon.redemptionType === 'ONCE'
                    ? '⚡ One-Time Promotional'
                    : '♾️ Infinite Multi-Use'
                  : 'Single User Referral'}
              </Badge>

              {/* Marketing Mapping Badge */}
              {isDirectAdmin && (
                <Badge
                  className={`text-xs font-semibold px-3 py-1 border ${
                    coupon.mapToMarketing
                      ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                      : 'bg-white/5 text-neutral-400 border-white/10'
                  }`}
                >
                  {coupon.mapToMarketing ? '📢 Mapped to Marketing' : '🔒 Admin Only'}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-300 pt-1">
              <div>
                <span className="text-neutral-400 font-medium">Stock Target:</span>{' '}
                <span className="font-bold text-white text-sm">{coupon.stock?.name || 'Stock'}</span>
                <span className="text-[#4ADE80] font-semibold ml-1.5">
                  (₹{(coupon.stock?.price || 0).toLocaleString('en-IN')} / share)
                </span>
              </div>
              <div>
                <span className="text-neutral-400 font-medium">Discount Offer:</span>{' '}
                <span className="font-bold text-[#4ADE80]">
                  {coupon.discountType === 'PERCENTAGE' && coupon.discountPercentage
                    ? `${coupon.discountPercentage}% OFF`
                    : `₹${(coupon.discountAmount || 0).toLocaleString('en-IN')} OFF / share`}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 font-medium">Allowed Qty:</span>{' '}
                <span className="font-semibold text-white">
                  {coupon.minQuantity} - {coupon.maxQuantity >= 999999 ? 'No Limit' : coupon.maxQuantity} shares
                </span>
              </div>
            </div>
          </div>

          {/* Validity & Creator Meta Card */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-sm space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="text-neutral-400">Created At:</span>
              <span className="font-semibold text-white">
                {format(new Date(coupon.createdAt), 'dd MMM yyyy, hh:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-300">
              <span className="text-neutral-400">Valid Until:</span>
              <span className={`font-semibold ${isExpired ? 'text-rose-400' : 'text-[#4ADE80]'}`}>
                {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'dd MMM yyyy, hh:mm a') : 'Permanent'}
              </span>
            </div>
            <div className="flex items-start justify-between text-neutral-300 pt-1.5 border-t border-white/10">
              <span className="text-neutral-400">Created By:</span>
              <div className="text-right">
                <span className="font-bold text-white block">
                  {coupon.createdBy?.name || (isDirectAdmin ? 'Super Admin' : coupon.relationshipManager?.name || coupon.rmName || 'RM')}
                </span>
                <span className="text-[10px] text-[#4ADE80] font-semibold block">
                  {coupon.createdBy?.role ? coupon.createdBy.role.replace('_', ' ') : isDirectAdmin ? 'SUPER ADMIN' : 'RM'}
                  {coupon.createdBy?.email ? ` • ${coupon.createdBy.email}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Performance Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Unique Users Claimed */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Users Claimed</p>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-[#0F172A] tracking-tight">
              {metrics.uniqueUsersCount}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">Distinct customer accounts</p>
          </CardContent>
        </Card>

        {/* Total Redemptions */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Sales</p>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-[#16A34A] tracking-tight">
              {metrics.totalRedemptions}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">Paid order conversions</p>
          </CardContent>
        </Card>

        {/* Total Shares Sold */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Shares Sold</p>
              <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-purple-950 tracking-tight">
              {metrics.totalSharesSold.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">
              Avg {metrics.avgSharesPerOrder} sh / order
            </p>
          </CardContent>
        </Card>

        {/* Gross Order Volume */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Gross Volume</p>
              <div className="h-7 w-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-xl font-black text-[#0F172A] tracking-tight">
              ₹{metrics.totalGrossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">Pre-discount order value</p>
          </CardContent>
        </Card>

        {/* Discounts Subsidized */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Discounts Given</p>
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-xl font-black text-amber-600 tracking-tight">
              -₹{metrics.totalDiscountDisbursed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">Customer savings disbursed</p>
          </CardContent>
        </Card>

        {/* Realized Net Sales */}
        <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Net Realized</p>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <h3 className="text-xl font-black text-[#16A34A] tracking-tight">
              ₹{metrics.totalNetSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-[#64748B] font-medium">
              Avg ₹{metrics.avgOrderValue.toLocaleString('en-IN')} / order
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Tabs & Redemptions Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 md:p-5 border-b border-neutral-200/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('REDEMPTIONS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'REDEMPTIONS'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-neutral-100 text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Redemption Orders ({allOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CUSTOMERS'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-neutral-100 text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Claimed Customers ({metrics.uniqueUsersCount})
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
              <Input
                placeholder="Search by customer, email, phone, order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-neutral-200 bg-[#F8FAFC] focus:bg-white"
              />
            </div>

            {activeTab === 'REDEMPTIONS' && (
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    statusFilter === 'PAID'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Paid Only
                </button>
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    statusFilter === 'PENDING'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Pending
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Orders Table */}
        {activeTab === 'REDEMPTIONS' && (
          <div>
            {allOrders.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-[#94A3B8]">
                  <Ticket className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">No redemptions recorded yet</h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  This coupon code has not been redeemed on any customer orders yet. Once users apply this code during checkout, their transactions will appear here live.
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <h3 className="text-sm font-bold text-[#0F172A]">No matching redemptions</h3>
                <p className="text-xs text-[#64748B]">
                  No orders matched the current search or filter query.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                  }}
                  className="text-xs rounded-xl mt-2"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#F8FAFC]">
                    <TableRow className="border-b border-neutral-200/60">
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] py-3 pl-4">
                        Order #
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569]">
                        Customer Profile
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] text-center">
                        Shares Qty
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right">
                        Rate / Share
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right">
                        Discount Saved
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right">
                        Net Total Paid
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569]">
                        Status
                      </TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-[#475569] text-right pr-4">
                        Redeemed Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredOrders.map((ord) => {
                      const isPaid = ['PAID', 'ALLOCATED', 'COMPLETED'].includes(ord.status || '');
                      const orderNum = ord.orderNumber || ord.id;

                      return (
                        <TableRow key={ord.id} className="border-b border-neutral-100 hover:bg-[#F8FAFC]/80 transition-colors">
                          {/* Order Number */}
                          <TableCell className="pl-4 py-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-extrabold text-[#0F172A] bg-[#F1F5F9] px-2 py-0.5 rounded border border-neutral-200/60">
                                {orderNum.slice(0, 14)}
                              </span>
                              <button
                                onClick={() => copyOrderId(orderNum)}
                                className="h-6 w-6 rounded hover:bg-neutral-100 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
                                title="Copy Order Number"
                              >
                                {copiedOrderId === orderNum ? (
                                  <Check className="h-3 w-3 text-[#16A34A]" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          {/* Customer Profile */}
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-[#0F172A]">
                                {ord.user?.fullName || 'Registered Client'}
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                {ord.user?.email || 'No email provided'}
                              </span>
                              {ord.user?.phone && (
                                <span className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                                  📞 {ord.user.phone}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Shares Qty */}
                          <TableCell className="text-center py-3">
                            <Badge variant="outline" className="font-mono font-bold text-xs bg-purple-50 text-purple-700 border-purple-200">
                              {(ord.quantity || 0).toLocaleString('en-IN')}
                            </Badge>
                          </TableCell>

                          {/* Rate per share */}
                          <TableCell className="text-right py-3 font-semibold text-xs text-[#0F172A]">
                            ₹{(ord.pricePerShare || 0).toLocaleString('en-IN')}
                          </TableCell>

                          {/* Discount Applied */}
                          <TableCell className="text-right py-3 font-extrabold text-xs text-emerald-600 font-mono">
                            -₹{(ord.discountApplied || 0).toLocaleString('en-IN')}
                          </TableCell>

                          {/* Net Paid */}
                          <TableCell className="text-right py-3 font-black text-xs text-[#0F172A] font-mono">
                            ₹{(ord.totalAmount || 0).toLocaleString('en-IN')}
                          </TableCell>

                          {/* Order Status */}
                          <TableCell className="py-3">
                            {isPaid ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                {ord.status}
                              </Badge>
                            ) : ord.status === 'PENDING' ? (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                                Pending Payment
                              </Badge>
                            ) : (
                              <Badge className="bg-neutral-100 text-neutral-700 border-neutral-200 text-[10px] font-bold">
                                {ord.status || 'Other'}
                              </Badge>
                            )}
                          </TableCell>

                          {/* Redeemed Date */}
                          <TableCell className="text-right pr-4 py-3 text-xs text-[#64748B] whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 font-medium">
                              <Calendar className="h-3 w-3 text-[#94A3B8]" />
                              {ord.createdAt ? format(new Date(ord.createdAt), 'dd MMM yyyy, p') : '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Claimed Customers Summary */}
        {activeTab === 'CUSTOMERS' && (
          <div className="p-4 md:p-6">
            {metrics.uniqueUsersList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-2" />
                <h3 className="text-sm font-bold text-[#0F172A]">No customer redemptions yet</h3>
                <p className="text-xs text-[#64748B]">
                  No customers have completed orders using this promotional code yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.uniqueUsersList.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-[#F8FAFC] border border-neutral-200/70 space-y-3 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#0F172A]">
                          {entry.user.fullName || 'Customer'}
                        </h4>
                        <p className="text-xs text-[#64748B]">{entry.user.email}</p>
                        {entry.user.phone && (
                          <p className="text-[11px] text-[#94A3B8] font-mono mt-0.5">
                            📞 {entry.user.phone}
                          </p>
                        )}
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px]">
                        {entry.orderCount} {entry.orderCount === 1 ? 'Order' : 'Orders'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200/50 text-xs">
                      <div>
                        <span className="text-[#64748B] text-[10px] block">Shares Acquired</span>
                        <span className="font-bold text-[#0F172A] font-mono">
                          {entry.totalShares.toLocaleString('en-IN')} shares
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] text-[10px] block">Total Amount Spent</span>
                        <span className="font-bold text-emerald-600 font-mono">
                          ₹{entry.totalSpent.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer info banner */}
        <div className="p-4 bg-[#F8FAFC] border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between text-xs text-[#64748B] gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
            <span>
              All transactions are reconciled with Cashfree payment gateway & physical stock ledger allocations.
            </span>
          </div>
          <p className="font-medium text-[11px]">
            Showing {filteredOrders.length} of {allOrders.length} total coupon orders
          </p>
        </div>
      </div>
    </div>
  );
}
