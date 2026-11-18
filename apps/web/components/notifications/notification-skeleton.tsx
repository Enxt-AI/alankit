import { Skeleton } from "@/components/ui/skeleton";

/**
 * NotificationSkeleton
 *
 * Used in the navbar notifications dropdown while recent notifications are loading.
 */
export function NotificationSkeleton() {
  return (
    <div className="space-y-2 px-2 py-1.5">
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}
