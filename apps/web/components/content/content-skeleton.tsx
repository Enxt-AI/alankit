"use client";

/**
 * ContentSkeleton Component
 * 
 * Reusable loading skeleton for content listings
 */

import { Skeleton } from "@/components/ui/skeleton";

interface ContentSkeletonProps {
  count?: number;
}

export function ContentSkeleton({ count = 6 }: ContentSkeletonProps) {
  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </>
  );
}
