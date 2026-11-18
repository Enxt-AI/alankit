"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-1">
                <Skeleton className="h-8 w-32" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24 hidden sm:block" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            {/* Summary Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-8 w-32" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Skeleton - Single Wide Card */}
            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="flex justify-end gap-2 mb-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Skeleton key={i} className="h-6 w-8" />
                            ))}
                        </div>
                        <Skeleton className="h-[300px] w-full rounded-lg" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
