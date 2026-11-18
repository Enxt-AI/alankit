"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useStaticPages } from "@/hooks/use-static-pages";
import { useAdminNews, useAdminArticles } from "@/hooks/use-admin-content";
import { useAdminFaqs } from "@/hooks/use-admin-faqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Package,
  FileText,
  Newspaper,
  HelpCircle,
  FileEdit,
  Activity,
  AlertCircle,
  TrendingUp,
  Info,
} from "lucide-react";

function StatCard({
  title,
  icon: Icon,
  value,
  subtitle,
  isLoading,
  onClick,
  disabled,
  description,
}: {
  title: string;
  icon: React.ElementType;
  value: React.ReactNode;
  subtitle: React.ReactNode;
  isLoading: boolean;
  onClick?: () => void;
  disabled?: boolean;
  description?: string;
}) {
  if (disabled) {
    return (
      <div 
        className="group flex flex-col justify-between p-5 bg-white rounded-[20px] border border-neutral-200/40"
        style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
      >
        <div className="flex items-center justify-between pb-2">
          <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">{title}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 flex-shrink-0">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-2 text-xs text-[#64748B]/80 leading-relaxed font-medium">
          {description}
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
        onClick && "cursor-pointer"
      )}
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
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default function CMSDashboardPage() {
  const router = useRouter();
  const { cmsAdmin } = useAuthStore();

  const hasStaticPagesPermission =
    cmsAdmin?.permissions?.includes("cms_static_pages") ||
    cmsAdmin?.role === "SUPER_ADMIN";
  const hasNewsPermission =
    cmsAdmin?.permissions?.includes("cms_news") ||
    cmsAdmin?.role === "SUPER_ADMIN";
  const hasArticlesPermission =
    cmsAdmin?.permissions?.includes("cms_articles") ||
    cmsAdmin?.role === "SUPER_ADMIN";
  const hasFaqsPermission =
    cmsAdmin?.permissions?.includes("cms_faqs") ||
    cmsAdmin?.role === "SUPER_ADMIN";
  const hasStocksPermission =
    cmsAdmin?.permissions?.includes("cms_stocks") ||
    cmsAdmin?.role === "SUPER_ADMIN";

  // Fetch real statistics
  let staticPages: any[] = [];
  let isLoadingPages = false;
  let pagesError = null;
  let refetchPages = () => {};
  if (hasStaticPagesPermission) {
    const { data, isLoading, error, refetch } = useStaticPages(true, true);
    staticPages = data || [];
    isLoadingPages = isLoading;
    pagesError = error;
    refetchPages = refetch;
  }

  let news: any[] = [];
  let isLoadingNews = false;
  let newsError = null;
  let refetchNews = () => {};
  if (hasNewsPermission) {
    const { data, isLoading, error, refetch } = useAdminNews(true, true);
    news = data || [];
    isLoadingNews = isLoading;
    newsError = error;
    refetchNews = refetch;
  }

  let articles: any[] = [];
  let isLoadingArticles = false;
  let articlesError: Error | null = null;
  let refetchArticles = () => {};
  if (hasArticlesPermission) {
    const { data, isLoading, error, refetch } = useAdminArticles(true, true);
    articles = data || [];
    isLoadingArticles = isLoading;
    articlesError = error;
    refetchArticles = refetch;
  }

  let faqs: any[] = [];
  let isLoadingFaqs = false;
  let faqsError = null;
  let refetchFaqs = () => {};
  if (hasFaqsPermission) {
    const { data, isLoading, error, refetch } = useAdminFaqs(true, true);
    faqs = data || [];
    isLoadingFaqs = isLoading;
    faqsError = error;
    refetchFaqs = refetch;
  }

  // Calculate stats
  const publishedArticles = articles.filter((b) => b.isActive).length;
  const publishedNews = news.filter((n) => n.isActive).length;
  const activeFAQs = faqs.filter((f) => f.isActive).length;
  const totalPages = staticPages.length;

  // Loading and error states
  const isLoadingStats =
    isLoadingPages || isLoadingNews || isLoadingArticles || isLoadingFaqs;
  const hasError = pagesError || newsError || articlesError || faqsError;
  const hasNoPermissions =
    cmsAdmin?.role === "CONTENT_MANAGER" && cmsAdmin?.permissions?.length === 0;

  // Refetch all stats
  const refetchAll = () => {
    refetchPages();
    refetchNews();
    refetchArticles();
    refetchFaqs();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">CMS Dashboard</h1>
          <p className="text-sm font-medium text-[#64748B] mt-1">
            Welcome back, <span className="text-[#16A34A] font-semibold">{cmsAdmin?.fullName || "Content Manager"}</span>!
          </p>
        </div>
        <Badge className="bg-[#ECFDF5] hover:bg-[#DCFCE7] border border-[#16A34A]/20 text-[10px] font-bold text-[#16A34A] tracking-wider rounded px-2.5 py-0.5 uppercase transition-all duration-250 cursor-default">
          {cmsAdmin?.role === "SUPER_ADMIN" ? "Super Admin" : "Content Manager"}
        </Badge>
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
          <TabsTrigger
            value="content"
            className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] transition-all duration-250 data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] hover:text-[#16A34A]"
          >
            Content Management
          </TabsTrigger>
        </TabsList>

        {/* Overview TabsContent */}
        <TabsContent value="overview" className="space-y-6">
          {/* Error Alert */}
          {hasError && !hasNoPermissions && (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="flex items-center justify-between text-red-800">
                <span>Failed to load statistics. Please try again.</span>
                <Button variant="outline" size="sm" onClick={refetchAll} className="rounded-xl border-red-200 text-red-800 hover:bg-red-100/50">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* No Permissions Alert */}
          {hasNoPermissions && (
            <Alert className="rounded-2xl border-[#16A34A]/25 bg-[#ECFDF5]/50 text-[#0F172A]">
              <Info className="h-4 w-4 text-[#16A34A]" />
              <AlertDescription className="text-sm font-medium">
                No permissions assigned. Contact your administrator to access CMS features.
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Stats Cards */}
          {!hasNoPermissions && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Static Pages"
                icon={FileEdit}
                value={totalPages}
                subtitle="Total pages"
                isLoading={isLoadingStats}
                disabled={!hasStaticPagesPermission}
                description="Static Pages management is disabled. Enable cms_static_pages permission."
                onClick={() => router.push("/cms/static-pages")}
              />
              <StatCard
                title="Published Articles"
                icon={FileText}
                value={publishedArticles}
                subtitle="Active article posts"
                isLoading={isLoadingStats}
                disabled={!hasArticlesPermission}
                description="Article management is disabled. Enable cms_articles permission."
                onClick={() => router.push("/cms/articles")}
              />
              <StatCard
                title="Published News"
                icon={Newspaper}
                value={publishedNews}
                subtitle="Active news articles"
                isLoading={isLoadingStats}
                disabled={!hasNewsPermission}
                description="News management is disabled. Enable cms_news permission."
                onClick={() => router.push("/cms/news")}
              />
              <StatCard
                title="FAQ Entries"
                icon={HelpCircle}
                value={activeFAQs}
                subtitle="Helpful FAQ entries"
                isLoading={isLoadingStats}
                disabled={!hasFaqsPermission}
                description="FAQ management is disabled. Enable cms_faqs permission."
                onClick={() => router.push("/cms/faqs")}
              />
            </div>
          )}

          {/* Recent Activity Section */}
          <div 
            className="relative bg-white rounded-[20px] border border-neutral-200/40 p-6 transition-all duration-300"
            style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
          >
            <div className="mb-5">
              <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-[#16A34A]" />
                Recent Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Latest content updates and management activities
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="group/item flex items-center justify-between p-4 bg-white border border-neutral-200/30 rounded-[14px] transition-all duration-300 hover:bg-[#F8FAFC]">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">CMS Dashboard Initialized</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Content Management System is now ready for use
                  </p>
                </div>
                <Badge className="bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9] border text-[10px] font-bold tracking-wide rounded-lg px-2.5 py-0.5 uppercase">
                  System
                </Badge>
              </div>

              <div className="group/item flex items-center justify-between p-4 bg-white border border-neutral-200/30 rounded-[14px] transition-all duration-300 hover:bg-[#F8FAFC]">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">Authentication System Active</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Session isolation between Admin and CMS panels confirmed
                  </p>
                </div>
                <Badge className="bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20 hover:bg-[#ECFDF5] border text-[10px] font-bold tracking-wide rounded-lg px-2.5 py-0.5 uppercase">
                  Security
                </Badge>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Content Management TabsContent */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Stocks Management Card */}
            {hasStocksPermission ? (
              <div 
                className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                onClick={() => router.push("/cms/stocks")}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                    <Package className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Stocks Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Manage stock listings and information</p>
                </div>
                <Button
                  className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/cms/stocks");
                  }}
                >
                  Manage Stocks
                </Button>
              </div>
            ) : (
              <div 
                className="relative bg-white rounded-[20px] border border-neutral-200/40 p-5 flex flex-col justify-between min-h-[170px]"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-3">
                    <Package className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Stocks Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Stock management requires permission</p>
                </div>
                <div className="text-xs text-[#64748B] leading-relaxed font-medium mt-4">
                  Contact administrator to enable <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-semibold text-[#0F172A]">cms_stocks</code>.
                </div>
              </div>
            )}

            {/* Articles Management Card */}
            {hasArticlesPermission ? (
              <div 
                className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                onClick={() => router.push("/cms/articles")}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Articles Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Create and edit article posts</p>
                </div>
                <Button
                  className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/cms/articles");
                  }}
                >
                  Manage Articles
                </Button>
              </div>
            ) : (
              <div 
                className="relative bg-white rounded-[20px] border border-neutral-200/40 p-5 flex flex-col justify-between min-h-[170px]"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-3">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Articles Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Article management requires permission</p>
                </div>
                <div className="text-xs text-[#64748B] leading-relaxed font-medium mt-4">
                  Contact administrator to enable <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-semibold text-[#0F172A]">cms_articles</code>.
                </div>
              </div>
            )}

            {/* News Management Card */}
            {hasNewsPermission ? (
              <div 
                className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                onClick={() => router.push("/cms/news")}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                    <Newspaper className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">News Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Publish and update news articles</p>
                </div>
                <Button
                  className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/cms/news");
                  }}
                >
                  Manage News
                </Button>
              </div>
            ) : (
              <div 
                className="relative bg-white rounded-[20px] border border-neutral-200/40 p-5 flex flex-col justify-between min-h-[170px]"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-3">
                    <Newspaper className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">News Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">News management requires permission</p>
                </div>
                <div className="text-xs text-[#64748B] leading-relaxed font-medium mt-4">
                  Contact administrator to enable <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-semibold text-[#0F172A]">cms_news</code>.
                </div>
              </div>
            )}

            {/* FAQs Management Card */}
            {hasFaqsPermission ? (
              <div 
                className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                onClick={() => router.push("/cms/faqs")}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">FAQs Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">Maintain frequently asked questions</p>
                </div>
                <Button
                  className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/cms/faqs");
                  }}
                >
                  Manage FAQs
                </Button>
              </div>
            ) : (
              <div 
                className="relative bg-white rounded-[20px] border border-neutral-200/40 p-5 flex flex-col justify-between min-h-[170px]"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-3">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">FAQs Management</h4>
                  <p className="text-xs text-[#64748B] mt-1">FAQ management requires permission</p>
                </div>
                <div className="text-xs text-[#64748B] leading-relaxed font-medium mt-4">
                  Contact administrator to enable <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-semibold text-[#0F172A]">cms_faqs</code>.
                </div>
              </div>
            )}

            {/* Static Pages Management Card */}
            {hasStaticPagesPermission ? (
              <div 
                className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
                onClick={() => router.push("/cms/static-pages")}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                    <FileEdit className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Static Pages</h4>
                  <p className="text-xs text-[#64748B] mt-1">Manage About Us, Contact, Terms pages</p>
                </div>
                <Button
                  className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/cms/static-pages");
                  }}
                >
                  Manage Pages
                </Button>
              </div>
            ) : (
              <div 
                className="relative bg-white rounded-[20px] border border-neutral-200/40 p-5 flex flex-col justify-between min-h-[170px]"
                style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mb-3">
                    <FileEdit className="h-5 w-5" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#0F172A]">Static Pages</h4>
                  <p className="text-xs text-[#64748B] mt-1">Static page management requires permission</p>
                </div>
                <div className="text-xs text-[#64748B] leading-relaxed font-medium mt-4">
                  Contact administrator to enable <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs font-semibold text-[#0F172A]">cms_static_pages</code>.
                </div>
              </div>
            )}

            {/* Analytics Card */}
            <div 
              className="group relative bg-white rounded-[20px] border border-neutral-200/40 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex flex-col justify-between min-h-[170px] cursor-pointer"
              style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}
              onClick={() => router.push("/cms/analytics")}
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] mb-3">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h4 className="text-[15px] font-bold text-[#0F172A]">Analytics</h4>
                <p className="text-xs text-[#64748B] mt-1">View content performance metrics</p>
              </div>
              <Button
                className="w-full mt-4 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/cms/analytics");
                }}
              >
                View Analytics
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
