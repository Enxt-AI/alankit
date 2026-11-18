"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export function SupportsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-8 animate-pulse">
      {/* 1. Header & Search Section Skeleton */}
      <div className="text-center space-y-6 py-8">
        <Skeleton className="h-10 md:h-12 w-3/4 max-w-sm mx-auto rounded-xl" />
        <Skeleton className="h-5 w-2/3 max-w-md mx-auto rounded-lg" />

        <div className="max-w-2xl mx-auto relative mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Left Column: Submit a Request Form Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
              <CardTitle className="text-xl">
                <Skeleton className="h-6 w-48 rounded-lg" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
                <Skeleton className="h-10 w-32 rounded-lg mt-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. Right Column: Sidebar (Tickets & Help) Skeleton */}
        <div className="space-y-6">
          {/* Your Tickets Widget Skeleton */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-32 rounded-lg" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24 rounded-md" />
                      <Skeleton className="h-3 w-16 rounded-md" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Urgent Help Widget Skeleton */}
          <div className="rounded-xl bg-green-600/50 p-6 shadow-lg relative overflow-hidden">
            <Skeleton className="h-6 w-40 rounded-lg bg-green-100/50 mb-2" />
            <Skeleton className="h-4 w-full rounded-md bg-green-100/50 mb-2" />
            <Skeleton className="h-4 w-3/4 rounded-md bg-green-100/50 mb-6" />
            <Skeleton className="h-10 w-32 rounded-lg bg-white/50" />
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: FAQs Skeleton */}
      <div className="max-w-7xl mx-auto">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-64 rounded-lg" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
