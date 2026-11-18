import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BasketSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between p-1">
      <CardHeader className="p-6 flex-row gap-4 space-y-0">
        {/* Icon skeleton */}
        <Skeleton className="h-20 w-20 rounded-lg shrink-0" />

        <div className="flex-1 space-y-2">
          {/* Name skeleton */}
          <Skeleton className="h-8 w-3/4" />

          {/* Badge skeletons */}
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardHeader>

      <div className="px-6 pb-2">
        {/* Description placeholder */}
        <Skeleton className="h-5 w-full" />
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Metrics Row */}
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-1 flex flex-col items-end">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        {/* Button skeletons */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}
