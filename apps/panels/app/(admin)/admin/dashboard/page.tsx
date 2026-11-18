"use client";

import { useAuthStore } from "@/store/auth-store";
import {
  useStocksServiceStats,
  useAuthServiceStats,
  useMarketingStats,
} from "@/hooks/use-admin-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  UserPlus,
  Activity,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Target,
  ArrowRight,
  Shield,
  ChevronDown,
} from "lucide-react";

function StatCard({
  title,
  icon: Icon,
  value,
  subtitle,
  isLoading,
  href,
}: {
  title: string;
  icon: React.ElementType;
  value: React.ReactNode;
  subtitle: React.ReactNode;
  isLoading: boolean;
  href?: string;
}) {
  return (
    <div 
      className="group flex items-center gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
      style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 transition-colors duration-300 ease-in-out group-hover:bg-[#DCFCE7]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">{title}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-16 rounded-lg mt-0.5" />
        ) : (
          <p className="text-2xl font-bold text-[#0F172A] tracking-tight leading-none mt-0.5">{value}</p>
        )}
        <p className="text-[11px] font-medium text-[#64748B] mt-1 truncate">
          {href ? (
            <a href={href} className="hover:text-[#16A34A] transition-colors">{subtitle}</a>
          ) : (
            subtitle
          )}
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { admin } = useAuthStore();

  const {
    data: stocksStats,
    isLoading: isLoadingStocks,
    error: stocksError,
    refetch: refetchStocks,
  } = useStocksServiceStats();

  const {
    data: authStats,
    isLoading: isLoadingAuth,
    error: authError,
    refetch: refetchAuth,
  } = useAuthServiceStats();

  const {
    data: marketingStats,
    isLoading: isLoadingMarketing,
    error: marketingError,
    refetch: refetchMarketing,
  } = useMarketingStats();

  const isLoadingStats = isLoadingStocks || isLoadingAuth || isLoadingMarketing;
  const hasError = stocksError || authError || marketingError;

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Welcome back, <span className="text-[#16A34A] font-semibold">{admin?.fullName || "Admin"}</span>!
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-white border border-[#16A34A]/25 px-3 py-1.5 text-[13px] font-semibold text-[#16A34A] shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-all duration-300 ease-in-out cursor-default hover:bg-[#FAFBFC] hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
          <Shield className="h-3.5 w-3.5" />
          <span>{admin?.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-75 ml-0.5" />
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs defaultValue="overview" className="space-y-5">
        {/* TabsList */}
        <TabsList className="inline-flex h-[38px] items-center gap-1.5 rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1 shadow-[0_1px_3px_rgba(15,23,42,0.02)]">
          <TabsTrigger
            value="overview"
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
          >
            Overview
          </TabsTrigger>
          {admin?.role === "SUPER_ADMIN" && (
            <TabsTrigger
              value="admin-mgmt"
              className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
            >
              Admin Management
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview TabsContent */}
        <TabsContent value="overview" className="space-y-6">
          {/* Error Alert */}
          {hasError && (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="flex items-center justify-between text-red-800">
                <span>Failed to load statistics. Please try again.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchStocks();
                    refetchAuth();
                    refetchMarketing();
                  }}
                  className="rounded-xl border-red-200 text-red-800 hover:bg-red-100/50"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Stocks"
              icon={Package}
              value={stocksStats?.totalStocks ?? 0}
              subtitle="Stocks in database"
              isLoading={isLoadingStats}
            />
            <StatCard
              title="Pending Orders"
              icon={FileText}
              value={stocksStats?.pendingOrders ?? 0}
              subtitle="Orders awaiting processing"
              isLoading={isLoadingStats}
            />
            <StatCard
              title="Total Users"
              icon={Users}
              value={authStats?.totalUsers ?? 0}
              subtitle="Registered users"
              isLoading={isLoadingStats}
            />
            <StatCard
              title="Pending KYC"
              icon={UserPlus}
              value={authStats?.pendingKycUsers ?? 0}
              subtitle="Review pending"
              isLoading={isLoadingStats}
              href="/admin/users/kyc-pending"
            />
          </div>

          {/* Secondary Stats Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Verified Users"
              icon={Activity}
              value={authStats?.verifiedUsers ?? 0}
              subtitle="Completed phone verification"
              isLoading={isLoadingStats}
            />
          </div>

          {/* Marketing Analytics Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Marketing Analytics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Track leads and campaign performance</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Leads"
                icon={TrendingUp}
                value={marketingStats?.totalLeads ?? 0}
                subtitle="From all campaigns"
                isLoading={isLoadingStats}
              />
              <StatCard
                title="Conversion Rate"
                icon={TrendingUp}
                value={`${marketingStats?.conversionRate?.toFixed(1) ?? 0}%`}
                subtitle={`${marketingStats?.convertedLeads ?? 0} converted leads`}
                isLoading={isLoadingStats}
              />
              <StatCard
                title="Top Source"
                icon={TrendingUp}
                value={marketingStats?.leadsBySource?.[0]?.source ?? "N/A"}
                subtitle={`${marketingStats?.leadsBySource?.[0]?.count ?? 0} leads`}
                isLoading={isLoadingStats}
              />
              <StatCard
                title="Top Campaign"
                icon={Target}
                value={marketingStats?.topCampaigns?.[0]?.name ?? "N/A"}
                subtitle={`${marketingStats?.topCampaigns?.[0]?.leadCount ?? 0} leads`}
                isLoading={isLoadingStats}
              />
            </div>
          </div>

          {/* Getting Started */}
          <div 
            className="group relative bg-white rounded-[24px] border border-neutral-200/40 overflow-hidden transition-all duration-250 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <div className="absolute top-4 right-4 flex gap-1.5 opacity-30">
              <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            </div>

            <div className="p-5 pb-2">
              <h3 className="text-base font-bold text-[#0F172A] tracking-tight">Getting Started</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Use the sidebar to navigate to different sections</p>
            </div>

            <div className="px-5 pb-5 pt-2">
              <div className="flex flex-col items-center justify-center py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] mb-3 text-[#16A34A] transition-colors duration-250 group-hover:bg-[#DCFCE7]">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-md mb-5">
                  Welcome to the Admin Panel! Use the sidebar to navigate and
                  manage different sections of the platform.
                </p>
                <ul className="w-full max-w-md space-y-2">
                  {[
                    { label: "Stocks", desc: "Manage stock listings, prices, and availability" },
                    { label: "Orders", desc: "View and update order statuses" },
                    { label: "CMS", desc: "Manage stocks, news, articles, FAQs, and static pages" },
                    { label: "Referrals", desc: "Update referral statuses and rewards" },
                    ...(admin?.role === "SUPER_ADMIN"
                      ? [{ label: "Admin Management", desc: "Create and manage admin accounts (Super Admin only)" }]
                      : []),
                  ].map((item) => (
                    <li key={item.label} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FAFBFC] border border-neutral-100 transition-colors hover:bg-[#ECFDF5]/30">
                      <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#16A34A] flex-shrink-0 mt-0.5">
                        <ArrowRight className="h-3 w-3" />
                      </div>
                      <div>
                        <span className="text-[13px] font-bold text-[#0F172A]">{item.label}:</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Admin Management TabsContent (Super Admin only) */}
        {admin?.role === "SUPER_ADMIN" && (
          <TabsContent value="admin-mgmt" className="space-y-6">
            {/* Admin Management Header */}
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Admin Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage admin accounts and permissions</p>
            </div>

            {/* Admin Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Total Admins"
                icon={LayoutDashboard}
                value={authStats?.totalAdmins ?? 0}
                subtitle="Admin accounts"
                isLoading={isLoadingStats}
              />
              <StatCard
                title="Active Admins"
                icon={UserPlus}
                value={authStats?.activeAdmins ?? 0}
                subtitle="Currently active"
                isLoading={isLoadingStats}
              />
              <StatCard
                title="Recent Activity"
                icon={Activity}
                value="Coming soon"
                subtitle="Last 24 hours"
                isLoading={false}
              />
            </div>

            {/* Quick Access Card */}
            <div 
              className="group relative bg-white rounded-[24px] border border-neutral-200/40 overflow-hidden transition-all duration-250 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
              style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
            >
              <div className="absolute top-4 right-4 flex gap-1.5 opacity-30">
                <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              </div>

              <div className="p-5 pb-2">
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight">Admin Management</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage admin accounts and permissions</p>
              </div>

              <div className="px-5 pb-5 pt-2">
                <p className="text-xs text-muted-foreground mb-4 max-w-xl">
                  Create new admin accounts, manage permissions, and control
                  access to various features. All admin management features are
                  now available.
                </p>
                <button
                  className="inline-flex items-center justify-center h-[40px] px-5 rounded-lg text-[13px] font-semibold text-white bg-[#16A34A] border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] transition-all duration-300 ease-in-out cursor-pointer"
                  onClick={() => window.location.href = '/admin/admins'}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Go to Admin Management
                </button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
