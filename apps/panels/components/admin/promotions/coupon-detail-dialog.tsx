'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  Copy,
  Check,
  Calendar,
  User,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Clock,
  Layers,
  Percent,
  IndianRupee,
  BarChart3,
  Megaphone,
  Lock,
} from 'lucide-react';
import { Coupon } from '@/lib/promotions-api';
import { format } from 'date-fns';

interface CouponDetailDialogProps {
  coupon: Coupon | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CouponDetailDialog({
  coupon,
  isOpen,
  onClose,
}: CouponDetailDialogProps) {
  const [hasCopied, setHasCopied] = useState(false);

  if (!coupon) return null;

  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const isDirectAdmin = !coupon.internalRmId && !coupon.distributorRmId;

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-neutral-200/60 shadow-2xl bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge className="bg-[#16A34A]/20 text-[#4ADE80] border-[#16A34A]/30 text-[11px] font-semibold">
                {isDirectAdmin ? 'SMC Admin Promotional' : 'RM Generated'}
              </Badge>
              {isDirectAdmin && (
                <Badge className="bg-white/15 text-white border-white/20 text-[10px] font-bold">
                  {coupon.redemptionType === 'ONCE' ? '⚡ One-Time Use' : '♾️ Infinite Multi-Use'}
                </Badge>
              )}
            </div>
            {coupon.isUsed ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold">
                Redeemed
              </Badge>
            ) : isExpired ? (
              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-xs font-bold">
                Expired
              </Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-bold">
                Active & Available
              </Badge>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Coupon Code</p>
              <p className="text-xl font-black tracking-wider text-white font-mono">{coupon.code}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-lg text-xs font-bold transition-all"
            >
              {hasCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-[#4ADE80]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Stock & Discount Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-neutral-200/60">
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Applicable Stock</p>
              <p className="text-sm font-black text-[#0F172A] mt-1">{coupon.stock?.name || 'Stock'}</p>
              <p className="text-[11px] font-semibold text-[#16A34A] mt-0.5">
                Price: ₹{coupon.stock?.price?.toLocaleString('en-IN') || 0} / share
              </p>
            </div>

            <div className="p-3 bg-[#F0FDF4] rounded-xl border border-[#16A34A]/20">
              <p className="text-[10px] font-bold uppercase text-[#166534]">Promotional Discount</p>
              <p className="text-sm font-black text-[#16A34A] mt-1">
                {coupon.discountType === 'PERCENTAGE' && coupon.discountPercentage
                  ? `${coupon.discountPercentage}% Off`
                  : `₹${(coupon.discountAmount || 0).toLocaleString('en-IN')} / Share`}
              </p>
              <p className="text-[11px] text-[#166534] mt-0.5">
                Min: {coupon.minQuantity} | Max: {coupon.maxQuantity >= 999999 ? 'Unlimited' : coupon.maxQuantity} shares
              </p>
            </div>
          </div>

          {/* Validity & Target */}
          <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Creation Date</p>
              <p className="font-semibold text-[#0F172A] mt-1">
                {format(new Date(coupon.createdAt), 'PPP p')}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Expiration Date</p>
              <p className="font-semibold text-[#0F172A] mt-1">
                {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'PPP') : 'No Expiry (Perpetual)'}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Assigned Audience</p>
              <p className="font-semibold text-[#0F172A] mt-1">
                {coupon.assignedUser
                  ? `${coupon.assignedUser.fullName || coupon.assignedUser.email || 'Targeted User'}`
                  : 'Public (Any Registered User)'}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Created By</p>
              <div className="mt-1">
                <p className="font-bold text-[#0F172A] text-xs">
                  {coupon.createdBy?.name || (isDirectAdmin ? 'Super Admin' : coupon.rmName || 'RM')}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] font-extrabold px-1.5 py-0">
                    {coupon.createdBy?.role ? coupon.createdBy.role.replace('_', ' ') : isDirectAdmin ? 'SUPER ADMIN' : 'RM'}
                  </Badge>
                  {coupon.createdBy?.email && (
                    <span className="text-[10px] text-[#64748B] truncate max-w-[150px]">
                      {coupon.createdBy.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-[#64748B]">Marketing Panel Mapping</p>
              <div className="mt-1 flex items-center gap-2">
                {coupon.mapToMarketing ? (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold flex items-center gap-1">
                    <Megaphone className="h-3 w-3 text-blue-600" /> Mapped to Marketing
                  </Badge>
                ) : (
                  <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-medium flex items-center gap-1">
                    <Lock className="h-3 w-3 text-slate-400" /> Admin Only (Unmapped)
                  </Badge>
                )}
              </div>
            </div>

          </div>

          {/* Multi-User / Redemption Details */}
          {isDirectAdmin ? (
            <div className="bg-[#EFF6FF] border border-blue-200/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <ShoppingBag className="h-4 w-4 text-blue-600" />
                  {coupon.redemptionType === 'ONCE'
                    ? `Single Redemption (${coupon.redemptionCount || coupon.orders?.length || 0}/1)`
                    : `Multi-User Redemptions (${coupon.redemptionCount || coupon.orders?.length || 0})`}
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                  {coupon.redemptionType === 'ONCE' ? 'One-Time Promo' : 'Infinite Multi-Use Promo'}
                </Badge>
              </div>

              {coupon.orders && coupon.orders.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {coupon.orders.map((ord: any, idx: number) => (
                    <div
                      key={ord.id || idx}
                      className="p-2.5 bg-white rounded-lg border border-blue-100 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <p className="font-bold text-blue-950">
                          {ord.user?.fullName || ord.user?.email || 'Customer'}
                        </p>
                        <p className="text-[10px] text-[#64748B] font-mono">
                          Order: {ord.orderNumber || ord.id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">
                          Saved ₹{(ord.discountApplied || 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-[#64748B]">
                          {ord.quantity} shares • {ord.createdAt ? format(new Date(ord.createdAt), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#64748B] italic">
                  No redemptions yet. This promotional code can be applied by any customer until {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'PPP') : 'expiry'}.
                </p>
              )}
            </div>
          ) : (
            coupon.isUsed && (
              <div className="bg-[#EFF6FF] border border-blue-200/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold">
                  <ShoppingBag className="h-4 w-4 text-blue-600" />
                  Single-Use RM Referral Redemption
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/40">
                  <div>
                    <span className="text-blue-600/80 font-medium">Redeemed By:</span>{' '}
                    <span className="font-bold text-blue-950">
                      {coupon.usedByUser?.fullName || coupon.usedByUser?.email || 'Customer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600/80 font-medium">Redeemed At:</span>{' '}
                    <span className="font-bold text-blue-950">
                      {coupon.usedAt ? format(new Date(coupon.usedAt), 'PPP p') : 'Completed'}
                    </span>
                  </div>
                  {coupon.order && (
                    <>
                      <div>
                        <span className="text-blue-600/80 font-medium">Order Number:</span>{' '}
                        <span className="font-mono font-bold text-blue-950">
                          {coupon.order.orderNumber || coupon.order.id}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-600/80 font-medium">Shares Purchased:</span>{' '}
                        <span className="font-bold text-blue-950">{coupon.order.quantity || 0}</span>
                      </div>
                      <div>
                        <span className="text-blue-600/80 font-medium">Total Paid:</span>{' '}
                        <span className="font-bold text-blue-950">
                          ₹{(coupon.order.totalAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-600/80 font-medium">Discount Given:</span>{' '}
                        <span className="font-bold text-emerald-600">
                          ₹{(coupon.order.discountApplied || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-[#F8FAFC] border-t border-neutral-100 flex items-center justify-between">
          <p className="text-[11px] text-[#64748B]">
            {coupon.isUsed ? '🔒 Redeemed coupons are permanently immutable.' : 'Unredeemed promotional code.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/marketing')
                  ? '/marketing'
                  : '/admin';
                window.open(
                  `${basePath}/promotions/sales-popup?id=${coupon.id}`,
                  `coupon_sales_${coupon.id}`,
                  'width=1200,height=900,status=no,menubar=no,resizable=yes,scrollbars=yes'
                );
              }}
              className="bg-[#16A34A] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Open Sales Pop-up
            </Button>
            <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-semibold">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

