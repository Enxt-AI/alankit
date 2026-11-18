"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function FooterSkeleton() {
  return (
    <footer className="w-full bg-black text-white">
      <div className="px-6 sm:px-10 lg:px-16 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-5">
            <Skeleton className="w-[160px] h-[34px] bg-white/10 rounded" />
            <div className="space-y-2 max-w-[280px]">
              <Skeleton className="h-3 w-full bg-white/10 rounded" />
              <Skeleton className="h-3 w-[85%] bg-white/10 rounded" />
              <Skeleton className="h-3 w-[70%] bg-white/10 rounded" />
            </div>
          </div>

          {/* Quick Links Column */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-16 bg-white/10 rounded" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-14 bg-white/10 rounded" />
              <Skeleton className="h-3.5 w-20 bg-white/10 rounded" />
            </div>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-12 bg-white/10 rounded" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-24 bg-white/10 rounded" />
              <Skeleton className="h-3.5 w-24 bg-white/10 rounded" />
              <Skeleton className="h-3.5 w-32 bg-white/10 rounded" />
            </div>
          </div>

          {/* Contact Column */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-20 bg-white/10 rounded" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-28 bg-white/10 rounded" />
              <Skeleton className="h-3.5 w-36 bg-white/10 rounded" />
              <Skeleton className="h-3.5 w-32 bg-white/10 rounded mt-1" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 mb-6 h-px bg-neutral-800" />

        {/* Bottom Bar */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <Skeleton className="h-3 w-48 bg-white/10 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full bg-white/10" />
            <Skeleton className="w-8 h-8 rounded-full bg-white/10" />
            <Skeleton className="w-8 h-8 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </footer>
  );
}
