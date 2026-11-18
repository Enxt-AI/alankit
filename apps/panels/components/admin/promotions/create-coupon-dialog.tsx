'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  Percent,
  IndianRupee,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Search,
  Infinity,
  Zap,
  Megaphone,
} from 'lucide-react';
import { useCouponStocks, useCreateCouponMutation } from '@/hooks/use-promotions';
import { notify } from '@/components/ui/floating-notification';

interface CreateCouponDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateCouponDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateCouponDialogProps) {
  const { data: stocks = [], isLoading: isLoadingStocks } = useCouponStocks();
  const createMutation = useCreateCouponMutation();

  // Form states
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);

  const [codeType, setCodeType] = useState<'AUTO' | 'CUSTOM'>('AUTO');
  const [customCode, setCustomCode] = useState<string>('');

  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<string>('');

  const [minQuantity, setMinQuantity] = useState<string>('');
  const [maxQuantity, setMaxQuantity] = useState<string>('');

  const [targetType, setTargetType] = useState<'PUBLIC' | 'USER'>('PUBLIC');
  const [assignedUserId, setAssignedUserId] = useState<string>('');

  const [redemptionType, setRedemptionType] = useState<'UNLIMITED' | 'ONCE'>('UNLIMITED');
  const [mapToMarketing, setMapToMarketing] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Selected Stock
  const selectedStock = useMemo(() => {
    return stocks.find((s) => s.id === selectedStockId);
  }, [stocks, selectedStockId]);

  // Update min quantity when stock changes
  useEffect(() => {
    if (selectedStock?.minimumPurchaseQuantity) {
      setMinQuantity(String(selectedStock.minimumPurchaseQuantity));
    }
  }, [selectedStock]);

  // Filtered stocks for selector
  const filteredStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return stocks;
    const q = stockSearchQuery.toLowerCase().trim();
    return stocks.filter((s) => s.name.toLowerCase().includes(q));
  }, [stocks, stockSearchQuery]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStockId('');
      setStockSearchQuery('');
      setIsStockDropdownOpen(false);
      setCodeType('AUTO');
      setCustomCode('');
      setDiscountType('FIXED');
      setDiscountAmount('');
      setDiscountPercentage('');
      setMinQuantity('10');
      setMaxQuantity('');
      setTargetType('PUBLIC');
      setAssignedUserId('');
      setRedemptionType('UNLIMITED');
      setMapToMarketing(false);
      setExpiresAt('');
      setErrorMsg('');
    }
  }, [isOpen]);

  // Calculations for real-time preview
  const parsedDiscountAmount = parseFloat(discountAmount) || 0;
  const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;

  const parsedMinQuantity = parseInt(minQuantity, 10) || selectedStock?.minimumPurchaseQuantity || 1;
  const parsedMaxQuantity = maxQuantity.trim() ? (parseInt(maxQuantity, 10) || 999999) : 999999;

  const effectiveDiscountPerShare = useMemo(() => {
    if (!selectedStock) return 0;
    if (discountType === 'PERCENTAGE') {
      return (selectedStock.price * parsedDiscountPercentage) / 100;
    }
    return parsedDiscountAmount;
  }, [selectedStock, discountType, parsedDiscountPercentage, parsedDiscountAmount]);

  const effectivePricePerShare = useMemo(() => {
    if (!selectedStock) return 0;
    return Math.max(0, selectedStock.price - effectiveDiscountPerShare);
  }, [selectedStock, effectiveDiscountPerShare]);

  const totalMinOrderValue = useMemo(() => {
    if (!selectedStock) return 0;
    return selectedStock.price * parsedMinQuantity;
  }, [selectedStock, parsedMinQuantity]);

  const totalDiscountAtMinQty = useMemo(() => {
    return effectiveDiscountPerShare * parsedMinQuantity;
  }, [effectiveDiscountPerShare, parsedMinQuantity]);

  const totalPayableAtMinQty = useMemo(() => {
    return Math.max(0, totalMinOrderValue - totalDiscountAtMinQty);
  }, [totalMinOrderValue, totalDiscountAtMinQty]);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedStock) {
      setErrorMsg('Please select a stock first.');
      return;
    }

    const minAllowed = selectedStock.minimumPurchaseQuantity || 1;
    const finalMinQty = parseInt(minQuantity, 10);
    if (isNaN(finalMinQty) || finalMinQty < minAllowed) {
      setErrorMsg(`Minimum quantity cannot be less than stock's minimum requirement (${minAllowed} shares).`);
      return;
    }

    const finalMaxQty = maxQuantity.trim() ? parseInt(maxQuantity, 10) : 999999;
    if (isNaN(finalMaxQty) || finalMaxQty < 1) {
      setErrorMsg('Please enter a valid maximum quantity.');
      return;
    }

    if (finalMinQty > finalMaxQty) {
      setErrorMsg('Minimum quantity cannot be greater than maximum quantity.');
      return;
    }

    if (discountType === 'FIXED') {
      if (parsedDiscountAmount <= 0) {
        setErrorMsg('Discount amount per share must be greater than 0.');
        return;
      }
      if (parsedDiscountAmount > selectedStock.price) {
        setErrorMsg(`Discount amount (₹${parsedDiscountAmount}) cannot exceed the stock price (₹${selectedStock.price}).`);
        return;
      }
    } else {
      if (parsedDiscountPercentage <= 0 || parsedDiscountPercentage > 100) {
        setErrorMsg('Discount percentage must be between 0.01% and 100%.');
        return;
      }
    }

    if (codeType === 'CUSTOM') {
      const cleaned = customCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (cleaned.length < 3 || cleaned.length > 30) {
        setErrorMsg('Custom coupon code must be between 3 and 30 alphanumeric characters.');
        return;
      }
    }

    if (!expiresAt) {
      setErrorMsg('Expiration date is mandatory for promotional coupons.');
      return;
    }

    if (new Date(expiresAt) <= new Date()) {
      setErrorMsg('Expiration date must be in the future.');
      return;
    }

    if (targetType === 'USER' && !assignedUserId.trim()) {
      setErrorMsg('Please enter a User ID for targeted coupon.');
      return;
    }

    try {
      const payload: any = {
        stockId: selectedStock.id,
        minQuantity: finalMinQty,
        maxQuantity: finalMaxQty,
        discountType,
        discountAmount: discountType === 'FIXED' ? parsedDiscountAmount : 0,
        discountPercentage: discountType === 'PERCENTAGE' ? parsedDiscountPercentage : undefined,
        code: codeType === 'CUSTOM' ? customCode.trim().toUpperCase() : undefined,
        assignedUserId: targetType === 'USER' && assignedUserId.trim() ? assignedUserId.trim() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        redemptionType,
        mapToMarketing,
      };

      const result = await createMutation.mutateAsync(payload);
      notify.success(`Coupon created successfully! Code: ${result.code}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create coupon.';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border border-neutral-200/60 shadow-2xl bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-5 text-white relative">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#16A34A]/20 text-[#4ADE80] border border-[#16A34A]/30">
              <Ticket className="h-4 w-4" />
            </span>
            <Badge className="bg-[#16A34A]/20 text-[#4ADE80] border-[#16A34A]/30 text-[11px] font-semibold">
              Admin Promotional System
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Create Promotional Coupon
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-300 mt-1">
            Generate customized or auto-branded discount coupons with up to 100% discount.
          </DialogDescription>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* 1. Stock Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Select Target Stock <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <div
                onClick={() => setIsStockDropdownOpen(!isStockDropdownOpen)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-white cursor-pointer transition-all ${
                  selectedStock ? 'border-[#16A34A] ring-1 ring-[#16A34A]/30' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {selectedStock ? (
                  <div className="flex items-center justify-between w-full pr-2">
                    <div>
                      <span className="font-bold text-sm text-[#0F172A]">{selectedStock.name}</span>
                      <span className="text-xs text-[#64748B] ml-2 font-medium">
                        Min Qty: {selectedStock.minimumPurchaseQuantity || 10} shares
                      </span>
                    </div>
                    <span className="font-extrabold text-sm text-[#16A34A]">
                      ₹{selectedStock.price.toLocaleString('en-IN')} / share
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-[#94A3B8]">
                    {isLoadingStocks ? 'Loading active stocks...' : 'Choose a stock for this coupon...'}
                  </span>
                )}
                <Search className="h-4 w-4 text-[#94A3B8] shrink-0" />
              </div>

              {/* Dropdown list */}
              {isStockDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl p-1.5">
                  <div className="p-1 mb-1">
                    <Input
                      placeholder="Search stock by name..."
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      className="h-8 text-xs rounded-lg"
                      autoFocus
                    />
                  </div>
                  {filteredStocks.length === 0 ? (
                    <p className="text-xs text-center py-4 text-[#94A3B8]">No matching stocks found</p>
                  ) : (
                    filteredStocks.map((stock) => (
                      <div
                        key={stock.id}
                        onClick={() => {
                          setSelectedStockId(stock.id);
                          setIsStockDropdownOpen(false);
                          setStockSearchQuery('');
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          stock.id === selectedStockId
                            ? 'bg-[#DCFCE7] text-[#16A34A] font-bold'
                            : 'hover:bg-[#F8FAFC] text-[#1E293B]'
                        }`}
                      >
                        <span className="truncate pr-2">{stock.name}</span>
                        <span className="font-bold shrink-0">₹{stock.price.toLocaleString('en-IN')}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Code Generation Style */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Coupon Code Configuration
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] rounded-xl">
              <button
                type="button"
                onClick={() => setCodeType('AUTO')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  codeType === 'AUTO'
                    ? 'bg-white text-[#0F172A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#16A34A]" />
                Auto-Generate (SMC-...)
              </button>
              <button
                type="button"
                onClick={() => setCodeType('CUSTOM')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  codeType === 'CUSTOM'
                    ? 'bg-white text-[#0F172A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Ticket className="h-3.5 w-3.5 text-[#16A34A]" />
                Custom Promo Code
              </button>
            </div>

            {codeType === 'CUSTOM' ? (
              <div className="relative mt-2">
                <Input
                  placeholder="e.g. WELCOME100, DIWALI50, VIPSHARE"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                  maxLength={30}
                  className="font-mono uppercase font-bold text-sm tracking-wider pr-16 rounded-xl border-neutral-200"
                />
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-[#94A3B8]">
                  {customCode.length}/30
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[#64748B] italic bg-[#F8FAFC] border border-neutral-200/50 rounded-lg px-3 py-2">
                Code will be automatically formatted as{' '}
                <span className="font-mono font-bold text-[#0F172A]">
                  SMC-{selectedStock ? selectedStock.name.substring(0, 3).toUpperCase() : 'STK'}-XXXXXX
                </span>
              </p>
            )}
          </div>

          {/* 3. Discount Type & Value */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Discount Mode & Value <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] rounded-xl mb-2">
              <button
                type="button"
                onClick={() => {
                  setDiscountType('FIXED');
                  setDiscountPercentage('');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  discountType === 'FIXED'
                    ? 'bg-white text-[#0F172A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <IndianRupee className="h-3.5 w-3.5 text-[#16A34A]" />
                Fixed (₹ per share)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType('PERCENTAGE');
                  setDiscountAmount('');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  discountType === 'PERCENTAGE'
                    ? 'bg-white text-[#0F172A] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Percent className="h-3.5 w-3.5 text-[#16A34A]" />
                Percentage (%)
              </button>
            </div>

            {discountType === 'FIXED' ? (
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-sm text-[#64748B]">₹</span>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={selectedStock ? selectedStock.price : undefined}
                    placeholder={`Enter amount per share (Max: ₹${selectedStock?.price || 0})`}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="pl-8 font-semibold rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Admins can give up to 100% flat discount (up to ₹{selectedStock?.price || 0} / share).
                </p>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    max="100"
                    placeholder="Enter discount percentage (0.01 to 100%)"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    className="pr-8 font-semibold rounded-xl"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-sm text-[#64748B]">%</span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Admins can offer up to 100% off for promotional campaigns.
                </p>
              </div>
            )}
          </div>

          {/* Real-time Pricing Preview Card */}
          {selectedStock && (
            <div className="bg-[#F0FDF4] border border-[#16A34A]/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#166534]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  Pricing Calculation Preview
                </span>
                <Badge className="bg-[#16A34A] text-white text-[10px] font-bold">
                  No Floor Price Restriction
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center pt-1 border-t border-[#16A34A]/20">
                <div className="p-2 bg-white rounded-lg border border-[#16A34A]/10">
                  <p className="text-[10px] font-bold uppercase text-[#64748B]">Original Price</p>
                  <p className="text-sm font-black text-[#0F172A] mt-0.5">
                    ₹{selectedStock.price.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#16A34A]/10">
                  <p className="text-[10px] font-bold uppercase text-[#64748B]">Discount / Share</p>
                  <p className="text-sm font-black text-[#16A34A] mt-0.5">
                    -₹{effectiveDiscountPerShare.toFixed(2)}
                  </p>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#16A34A]/10">
                  <p className="text-[10px] font-bold uppercase text-[#64748B]">Client Price</p>
                  <p className="text-sm font-black text-[#0F172A] mt-0.5">
                    ₹{effectivePricePerShare.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#166534] pt-1">
                <span>At Min Order ({parsedMinQuantity} shares):</span>
                <span className="font-bold">
                  Client pays ₹{totalPayableAtMinQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (Saved ₹
                  {totalDiscountAtMinQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })})
                </span>
              </div>
            </div>
          )}

          {/* 4. Quantity Rules */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Minimum Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={selectedStock?.minimumPurchaseQuantity || 1}
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder={String(selectedStock?.minimumPurchaseQuantity || 10)}
                className="font-medium rounded-xl"
              />
              <p className="text-[10px] text-[#94A3B8]">
                Stock minimum: {selectedStock?.minimumPurchaseQuantity || 10} shares
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Maximum Quantity
              </Label>
              <Input
                type="number"
                min={parsedMinQuantity}
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                placeholder="No limit (Default: 999,999)"
                className="font-medium rounded-xl"
              />
              <p className="text-[10px] text-[#94A3B8]">
                {maxQuantity.trim() && !isNaN(parseInt(maxQuantity, 10)) && parseInt(maxQuantity, 10) < 999999
                  ? `Capped at max ${parseInt(maxQuantity, 10).toLocaleString('en-IN')} shares`
                  : 'Leave empty for no limit (999,999 shares)'}
              </p>
            </div>
          </div>

          {/* 5. Target Audience & Expiration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Audience Scope
              </Label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as 'PUBLIC' | 'USER')}
                className="w-full h-10 px-3 py-2 text-xs font-bold text-[#0F172A] bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              >
                <option value="PUBLIC">Public (Any Registered User)</option>
                <option value="USER">Specific User Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Expiration Date <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  required
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  className="rounded-xl text-xs"
                />
              </div>
              <p className="text-[10px] text-[#16A34A] font-semibold mt-0.5">
                {redemptionType === 'UNLIMITED'
                  ? 'Active for infinite redemptions until this date.'
                  : 'Single-use code valid until this date (or until claimed).'}
              </p>
            </div>
          </div>

          {/* 6. Redemption Frequency & Usage Limit (One-Time vs Infinite Times) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Redemption Frequency & Usage Limit <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] rounded-xl">
              <button
                type="button"
                onClick={() => setRedemptionType('UNLIMITED')}
                className={`flex items-center gap-2.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
                  redemptionType === 'UNLIMITED'
                    ? 'bg-white text-[#0F172A] shadow-sm ring-1 ring-emerald-500/30'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Infinity className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-xs text-[#0F172A]">Multiple / Infinite Times</span>
                  <span className="text-[10px] text-[#64748B] font-medium block">Multi-user infinite claims</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRedemptionType('ONCE')}
                className={`flex items-center gap-2.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
                  redemptionType === 'ONCE'
                    ? 'bg-white text-[#0F172A] shadow-sm ring-1 ring-amber-500/30'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-xs text-[#0F172A]">One-Time Use</span>
                  <span className="text-[10px] text-[#64748B] font-medium block">Single redemption (burns on use)</span>
                </div>
              </button>
            </div>
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                redemptionType === 'UNLIMITED'
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
              }`}
            >
              {redemptionType === 'UNLIMITED' ? (
                <>
                  <Infinity className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Infinite Redemptions:</strong> You can share this coupon with multiple users. It can be redeemed multiple times without limit until the expiration date.
                  </p>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Single-Use Only:</strong> Can only be redeemed 1 time across the entire platform. As soon as the first order is paid, it will be marked as used and cannot be claimed again.
                  </p>
                </>
              )}
            </div>
          </div>

          {targetType === 'USER' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Assigned User ID <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Enter User CUID (e.g. clx123456789...)"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="font-mono text-xs rounded-xl"
              />
              <p className="text-[10px] text-[#94A3B8]">
                Only the specified user will be allowed to apply this promotional coupon at checkout.
              </p>
            </div>
          )}

          {/* 7. Marketing Panel Visibility */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="map-to-marketing" className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 cursor-pointer">
                  <Megaphone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  Map to Marketing Panel
                </Label>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  When enabled, this coupon will be visible to marketing users in their panel to track performance and sales redemptions.
                </p>
              </div>
              <input
                id="map-to-marketing"
                type="checkbox"
                checked={mapToMarketing}
                onChange={(e) => setMapToMarketing(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
            </div>
            {mapToMarketing ? (
              <div className="flex items-center gap-1.5 text-[10px] text-blue-800 bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-200/70 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                <span>Visible in Marketing Panel (/marketing/promotions) with sales analytics access.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-100/90 px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>Restricted to Admin Panel Only. Marketing users will not see this coupon unless mapped.</span>
              </div>
            )}
          </div>

          {/* Submit Footer */}
          <DialogFooter className="pt-3 border-t border-neutral-200/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-semibold"
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !selectedStock}
              className="rounded-xl text-xs font-bold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-md shadow-[#16A34A]/20"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Generating Coupon...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4 mr-1.5" />
                  Create Coupon
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
