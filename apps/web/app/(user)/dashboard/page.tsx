"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/auth-store";
import { KYCReminderPopup } from "@/components/kyc/kyc-reminder-popup";
import { PortfolioSummaryComponent } from "@/components/portfolio/portfolio-summary";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { TopHoldings } from "@/components/dashboard/top-holdings";
import { DashboardWatchlist } from "@/components/dashboard/dashboard-watchlist";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { usePortfolio } from "@/hooks/use-portfolio";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronDown } from "lucide-react";

const PortfolioCharts = dynamic(
  () =>
    import("@/components/portfolio/portfolio-charts").then((mod) => ({
      default: mod.PortfolioCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] rounded-xl bg-muted/40 animate-pulse border border-border/40 col-span-1 md:col-span-2" />
    ),
  }
);

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [, forceUpdate] = useState(0);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = usePortfolio();

  /* ----------------------------- Guards ----------------------------- */
  useEffect(() => {
    if (!isLoading && user && user.kycStatus !== "VERIFIED" && user.kycStatus !== "PENDING") {
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

  const summary = data?.summary || {
    totalCurrentValue: 0,
    totalInvestedValue: 0,
    totalProfitLoss: 0,
    totalProfitLossPercentage: 0,
    totalHoldings: 0,
    todayReturn: 0,
    dailyTrend: [],
    trend: [],
    weeklyTrend: [],
    yearlyTrend: [],
  };

  if (isLoading || (user && user.kycStatus !== "VERIFIED" && user.kycStatus !== "PENDING")) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex justify-center py-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load dashboard</AlertTitle>
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

  return (
    <div className="w-full">
        {/* ── HEADER ROW ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="md:text-xl text-lg font-bold tracking-tight text-slate-900">Welcome back, {(user as any)?.firstName || (user as any)?.name || "Investor"} 👋</h1>
            <p className="md:text-[13px] text-xs font-medium text-slate-600">
              Here's what's happening with your portfolio today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 md:px-4 md:py-2.5 px-3 py-2 rounded-xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-slate-50 transition-colors">
              <span className="md:text-[12px] text-[11px] font-bold text-slate-900">8 May, 2025</span>
            </div>
          </div>
        </div>

        {/* ── TOP METRICS ROW (4 CARDS) ── */}
        <PortfolioSummaryComponent summary={summary} />

        {/* ── GRID LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* ── PORTFOLIO PERFORMANCE CHART ── */}
          <PortfolioCharts 
            dailyTrend={summary.dailyTrend}
            trend={summary.trend} 
            weeklyTrend={summary.weeklyTrend} 
            yearlyTrend={summary.yearlyTrend}
          />

          {/* ── TOP HOLDINGS ── */}
          <TopHoldings holdings={data?.holdings || []} />

          {/* ── WATCHLIST ── */}
          <DashboardWatchlist />

          {/* ── RECENT TRANSACTIONS ── */}
          <RecentTransactions />
        </div>

        {/* KYC Reminder Popup */}
        <KYCReminderPopup />
    </div>
  );
}
