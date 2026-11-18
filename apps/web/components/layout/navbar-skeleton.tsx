"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function NavbarSkeleton() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b bg-white">
      <div className="relative flex h-full items-center justify-between px-3 sm:px-4 md:px-6 xl:px-8">
        {/* LEFT */}
        <div className="relative z-10 flex items-center gap-3">
          <Skeleton className="h-8 w-8 md:hidden rounded-md" />
          <Skeleton className="w-[100px] min-[375px]:w-[125px] sm:w-[135px] md:w-[145px] xl:w-[190px] h-[39px]" />
        </div>

        {/* CENTER */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-6 xl:gap-8">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>

        {/* RIGHT */}
        <div className="relative z-10 flex items-center gap-3">
          <Skeleton className="hidden lg:flex h-9 w-[170px] xl:w-[210px] rounded-xl" />
          <Skeleton className="h-9 w-9 md:h-9 md:w-9 rounded-md md:rounded-full" />
          <Skeleton className="hidden md:block h-9 w-9 rounded-full" />
        </div>
      </div>
    </nav>
  );
}
