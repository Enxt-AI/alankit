"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton component for stock cards
 * Matches the exact layout of StockCard as defined in stock-card.tsx
 */
export function StockSkeleton() {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between items-start bg-white rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 text-left w-full h-[290px] sm:h-[380px] animate-pulse"
      )}
    >
      {/* Top Section: Logo & Name Skeleton */}
      <div className="flex flex-col items-start w-full gap-2 sm:gap-3 mt-0 sm:mt-2">
        {/* Logo Skeleton */}
        <div className="w-[76px] h-[76px] sm:w-[112px] sm:h-[112px] shrink-0 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
          <Skeleton className="h-full w-full rounded-lg bg-neutral-100" />
        </div>

        {/* Name Skeleton */}
        <div className="w-full min-h-[32px] sm:min-h-[40px] flex flex-col items-start justify-center gap-1 sm:gap-1.5">
          <Skeleton className="h-3 sm:h-4 w-5/6 rounded bg-neutral-100" />
          <Skeleton className="h-3 sm:h-4 w-2/3 rounded bg-neutral-100" />
        </div>

        {/* CIN Skeleton */}
        <div className="w-full flex justify-start">
          <Skeleton className="h-3 sm:h-3.5 w-24 sm:w-32 rounded bg-neutral-100" />
        </div>
      </div>

      {/* Middle Section: Price & Badge Skeleton */}
      <div className="flex flex-col items-start mt-auto mb-2 sm:mb-4 gap-1.5 sm:gap-2">
        {/* Price Skeleton */}
        <Skeleton className="h-5 sm:h-7 w-16 sm:w-20 rounded-md bg-neutral-100" />

        {/* Badge & Label Skeleton */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Skeleton className="h-4 sm:h-5 w-10 sm:w-14 rounded-full bg-neutral-100" />
          <Skeleton className="h-2.5 sm:h-3 w-6 sm:w-8 rounded bg-neutral-100" />
        </div>
      </div>

      {/* Bottom Section: Button Skeleton */}
      <div className="w-full">
        <Skeleton className="h-8 sm:h-10 w-full rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}
