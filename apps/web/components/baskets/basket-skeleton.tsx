import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BasketSkeleton() {
  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 flex flex-col justify-between h-full">
      <div>
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 sm:h-13 sm:w-13 rounded-xl shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* Description lines */}
        <div className="space-y-1.5 mb-5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>

        {/* Constituent preview */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>

      <div className="space-y-3 pt-3">
        {/* Price box */}
        <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="space-y-1 border-l border-gray-200 pl-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>

        {/* Button */}
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </Card>
  );
}
