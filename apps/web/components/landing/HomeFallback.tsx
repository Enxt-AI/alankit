"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { StockSkeleton } from "@/components/stocks/stock-skeleton";

/**
 * HomeFallback Component
 *
 * A comprehensive skeleton loading state for the main landing page.
 * Mirrors the structure of apps/web/app/(main)/page.tsx
 */
export default function HomeFallback() {
  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero Section Skeleton */}
      <section className="relative w-full overflow-hidden bg-white pt-8 sm:pt-12 pb-12 flex flex-col items-center">
        <div className="relative z-10 w-full px-5 sm:px-10 md:px-16 lg:px-24 flex flex-col items-center text-center max-w-6xl mx-auto">
          {/* Powered by */}
          <Skeleton className="h-5 w-48 mb-4 rounded-full" />

          {/* Heading */}
          <div className="space-y-3 w-full flex flex-col items-center mb-4">
            <Skeleton className="h-12 sm:h-16 lg:h-[60px] w-full max-w-3xl rounded-lg" />
            <Skeleton className="h-12 sm:h-16 lg:h-[60px] w-3/4 max-w-2xl rounded-lg" />
          </div>

          {/* Subheading */}
          <div className="space-y-2 w-full flex flex-col items-center mb-6">
            <Skeleton className="h-6 w-full max-w-2xl rounded-md" />
            <Skeleton className="h-6 w-2/3 max-w-xl rounded-md" />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mb-12 sm:mb-20">
            <Skeleton className="h-12 w-full sm:w-40 rounded-xl" />
            <Skeleton className="h-12 w-full sm:w-40 rounded-xl" />
          </div>

          {/* Devices Composition Skeleton */}
          <div className="relative w-full max-w-[1000px] mx-auto flex justify-center h-[260px] sm:h-[300px] md:h-[350px] lg:h-[400px] xl:h-[440px] mb-8 mt-2">
            {/* Main Device (MacBook) */}
            <Skeleton className="w-[85%] sm:w-[75%] md:w-[70%] h-full rounded-[2rem]" />
            {/* Overlapping small device (iPhone) */}
            <Skeleton className="absolute left-[5%] md:left-[10%] bottom-0 w-[22%] sm:w-[18%] md:w-[15%] h-[75%] rounded-[1.5rem]" />
          </div>

          {/* Feature Grid */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-8 pt-8 border-t border-gray-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <Skeleton className="w-10 h-10 mb-4 rounded-full" />
                <Skeleton className="h-5 w-3/4 mb-2 rounded-md" />
                <Skeleton className="hidden sm:block h-4 w-full rounded-md" />
                <Skeleton className="hidden sm:block h-4 w-5/6 mt-1 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Stock Listing Section Skeleton */}
      <section className="py-12 md:py-20 bg-slate-50/70 border-y border-slate-200/60">
        <div className="w-full px-4">
          <div className="bg-white rounded-3xl md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-48 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <StockSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Comparison Section Skeleton */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 flex flex-col items-center gap-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-10 sm:h-12 w-64 sm:w-96 rounded-lg" />
            <Skeleton className="h-5 w-full max-w-xl rounded-md" />
          </div>

          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Feature Grid Skeleton */}
      <section className="py-16 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="p-6 bg-white rounded-2xl border border-gray-100 flex items-center gap-4"
              >
                <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                <Skeleton className="h-6 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. News & Articles Section Skeleton */}
      <section className="py-8 md:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Latest News Skeleton */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <div className="flex gap-4 sm:gap-6 overflow-hidden pb-4">
            {[...Array(4)].map((_, i) => (
              <div key={`news-skel-${i}`} className="flex-none w-[280px] sm:w-[320px]">
                <Skeleton className="h-[240px] w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Featured Articles Skeleton */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <div className="flex gap-4 sm:gap-6 overflow-hidden pb-4">
            {[...Array(4)].map((_, i) => (
              <div key={`article-skel-${i}`} className="flex-none w-[280px] sm:w-[340px]">
                <Skeleton className="h-[100px] w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
