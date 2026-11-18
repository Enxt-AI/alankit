'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CouponSalesPopupContent } from '@/components/admin/promotions/coupon-sales-popup-content';

export default function AdminCouponSalesPopupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
        </div>
      }
    >
      <CouponSalesPopupContent />
    </Suspense>
  );
}
