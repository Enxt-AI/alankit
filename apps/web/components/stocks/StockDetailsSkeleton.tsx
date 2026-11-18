"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * StockDetailsSkeleton Component
 *
 * A comprehensive skeleton loading state for the stock details page.
 * Mirrors the structure of apps/web/app/(main)/stocks/[id]/page.tsx
 */
export default function StockDetailsSkeleton() {
  return (
    <div className="p-2 md:p-10 space-y-8 overflow-hidden animate-pulse">
      {/* 1. Back Button Skeleton */}
      <Skeleton className="h-8 w-24 rounded-lg" />

      {/* 2. Stock Info Header Section Skeleton */}
      <div className="mt-6 flex flex-col sm:flex-row items-start gap-6">
        {/* Logo Placeholder */}
        <Skeleton className="h-36 w-36 rounded-2xl flex-shrink-0" />

        {/* Name, Price, Actions */}
        <div className="flex-1 w-full space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-2 w-full max-w-md">
              <Skeleton className="h-10 w-3/4 sm:w-full rounded-lg" />
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            {/* Action Buttons */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Skeleton className="h-10 w-full sm:w-32 rounded-lg" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>

          {/* Price */}
          <div className="flex items-end gap-3 pt-2">
            <Skeleton className="h-12 w-48 rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Meta Footer */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </div>
      </div>

      {/* 3. Main Content: Two-Column Layout */}
      <div className="flex flex-col gap-8">
        {/* Left Column: Chart & Financials */}
        <div className="flex-1 space-y-8">
          {/* Chart Placeholder */}
          <Card className="overflow-hidden border-none shadow-sm">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </Card>

          {/* Financial Metrics Placeholder */}
          <Card className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-48 rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-gray-50"
                >
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-4 w-1/4 rounded" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Company Overview */}
        <div className="w-full space-y-6">
          <Card className="p-6 h-full space-y-6">
            <Skeleton className="h-8 w-48 rounded-md" />

            {/* About Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-32 rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-11/12 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Bottom Sections: Key Fundamentals & Documents */}
      <div className="space-y-8">
        {/* Key Fundamentals */}
        <Card className="p-6 space-y-6">
          <Skeleton className="h-7 w-48 rounded-md" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50/50 space-y-3">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            ))}
          </div>
        </Card>

        {/* Stock Documents */}
        <div className="border border-gray-200 rounded-2xl p-6 bg-white space-y-6">
          <Skeleton className="h-7 w-48 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100"
              >
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Board of Directors at the end of the page */}
        <Card className="p-4 sm:p-6 space-y-5 rounded-2xl">
          <Skeleton className="h-7 w-48 rounded-md" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
