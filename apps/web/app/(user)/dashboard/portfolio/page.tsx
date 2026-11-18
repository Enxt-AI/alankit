"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { usePortfolio } from "@/hooks/use-portfolio";
import { useAuthStore } from "@/store/auth-store";

import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { EmptyPortfolio } from "@/components/portfolio/empty-portfolio";
import { PortfolioSkeleton } from "@/components/portfolio/portfolio-skeleton";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { AlertCircle, Briefcase } from "lucide-react";

export default function PortfolioPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = usePortfolio();

  const [, forceUpdate] = useState(0);

  const holdings = data?.holdings ?? [];

  /* ----------------------------- Guards ----------------------------- */

  useEffect(() => {
    if (
      !isLoading &&
      user &&
      user.kycStatus !== "VERIFIED" &&
      user.kycStatus !== "PENDING"
    ) {
      router.replace("/kyc");
    }
  }, [isLoading, user, router]);

  /* ----------------------------- Timers ----------------------------- */

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((p) => p + 1);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  /* ----------------------------- Helpers ----------------------------- */

  const getTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "just now";
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  /* ----------------------------- States ----------------------------- */

  if (
    isLoading ||
    (user && user.kycStatus !== "VERIFIED" && user.kycStatus !== "PENDING")
  ) {
    return <PortfolioSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load portfolio</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error?.message ?? "Something went wrong."}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (holdings.length === 0) {
    return <EmptyPortfolio onExploreStocks={() => router.push("/stocks")} />;
  }

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="space-y-6">
      {/* ── HEADER ROW ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="flex flex-col gap-1 pb-8 pt-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-slate-800" />
            <h1 className="text-[24px] font-bold text-slate-900">Portfolio</h1>
          </div>
          <p className="text-[14px] text-slate-500">
            Track your investments and performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
            className="h-9 px-3.5 rounded-sm text-xs font-semibold gap-2 border-border/80 hover:bg-muted/50 transition-colors shadow-none"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── HOLDINGS LIST ── */}
      <div className="w-full">
        <HoldingsTable
          holdings={holdings}
          onRowClick={(id) => router.push(`/stocks/${id}`)}
        />
      </div>
    </div>
  );
}
