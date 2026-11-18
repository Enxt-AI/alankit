"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useArticles, useArticleCategories } from "@/hooks/use-content";
import { articleUrl } from "@/lib/slugify";
import { getStorageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Heart,
  Share2,
  ArrowRight,
  BookOpen,
  Mail,
  FileText,
  CheckCircle2,
  X,
  ChevronUp,
} from "lucide-react";
import { useLikedContent } from "@/hooks/use-liked-content";
import type { Article } from "@/types/content";

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function getExcerpt(content: string, len = 110) {
  const plainText = content.replace(/<[^>]*>/g, "");
  return plainText.length > len ? plainText.substring(0, len) + "..." : plainText;
}

export default function ArticlesPage() {
  const router = useRouter();
  const { isLiked, toggleLike, likedItems } = useLikedContent();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState("newest");
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const [openSections, setOpenSections] = useState({
    category: true,
    date: true,
    sort: true,
  });

  // API Filters
  const apiFilters = useMemo(() => ({
    category: category === "all" ? undefined : category,
    startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
  }), [category, dateRange]);

  const { data: articles, isLoading, isError, error } = useArticles(apiFilters);
  const { data: categories } = useArticleCategories();

  const likedArticlesCount = useMemo(
    () => likedItems.filter((item) => item.contentType === "article").length,
    [likedItems]
  );

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (category !== "all") count++;
    if (dateRange?.from) count++;
    if (showLikedOnly) count++;
    return count;
  }, [category, dateRange, showLikedOnly]);

  // Local filtering & sorting
  const filteredArticles = useMemo(() => {
    let result = articles || [];

    if (showLikedOnly) {
      result = result.filter((a) => isLiked(a.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "newest") {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      result = [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return result;
  }, [articles, searchQuery, sortBy, showLikedOnly, isLiked]);

  const popularArticles = useMemo(() => (articles || []).slice(0, 5), [articles]);

  const resetFilters = () => {
    setSearchQuery("");
    setCategory("all");
    setDateRange(undefined);
    setSortBy("newest");
    setShowLikedOnly(false);
  };

  const handleShare = async (article: Article, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = window.location.origin + articleUrl(article);
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
      } catch (err) {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Article link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 sm:py-12 relative">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        
        {/* ── HEADER ROW ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1A2530] tracking-tight">
              Insights & Analysis
            </h1>
            <p className="text-slate-500 text-sm sm:text-[15px] font-medium mt-1">
              Market insights, expert analysis, and educational content to help you make informed decisions.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-[260px] lg:w-[300px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-emerald-500/20 focus-visible:border-emerald-600 shadow-sm"
              />
            </div>

            {/* Liked Articles Filter Button */}
            <button
              type="button"
              onClick={() => setShowLikedOnly((prev) => !prev)}
              className={`h-11 px-4 border rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 ${
                showLikedOnly
                  ? "border-rose-300 text-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20"
                  : "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
              }`}
            >
              <Heart className={`w-4 h-4 ${showLikedOnly ? "fill-rose-500 text-rose-500" : "text-rose-400"}`} />
              Liked
              {likedArticlesCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">
                  {likedArticlesCount}
                </span>
              )}
            </button>

            {/* Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`relative h-11 px-4 border rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 ${
                activeFiltersCount > 0
                  ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                  : "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
              }`}
            >
              <Filter className="w-4 h-4 text-emerald-600" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-sm">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── ACTIVE FILTER PILLS BAR ── */}
        {(category !== "all" || dateRange?.from || showLikedOnly) && (
          <div className="flex flex-wrap items-center gap-3 mb-4 animate-in fade-in duration-300">
            {showLikedOnly && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-bold">
                Showing Liked Articles
                <X
                  className="w-3.5 h-3.5 cursor-pointer hover:text-rose-950"
                  onClick={() => setShowLikedOnly(false)}
                />
              </span>
            )}

            {category !== "all" && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
                Category: {category}
                <X
                  className="w-3.5 h-3.5 cursor-pointer hover:text-emerald-950"
                  onClick={() => setCategory("all")}
                />
              </span>
            )}

            {dateRange?.from && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
                Date: {format(dateRange.from, "MMM d")} – {dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "Present"}
                <X
                  className="w-3.5 h-3.5 cursor-pointer hover:text-emerald-950"
                  onClick={() => setDateRange(undefined)}
                />
              </span>
            )}

            <button
              onClick={resetFilters}
              className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results count text */}
        <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-8">
          Showing {filteredArticles.length} {filteredArticles.length === 1 ? "article" : "articles"}
        </p>

        {/* ── MAIN CONTENT LAYOUT ── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column: 2-Column Article Grid */}
          <div className="flex-1 min-w-0 w-full">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-[24px] border border-slate-100 p-4 space-y-4">
                    <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center w-full">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No articles found</h3>
                <p className="text-slate-500 max-w-sm text-sm mb-6">
                  {showLikedOnly
                    ? "You haven't liked any articles yet. Click the heart icon on any article card to save it here!"
                    : "We couldn't find any articles matching your search or filters."}
                </p>
                <Button
                  onClick={resetFilters}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {filteredArticles.map((article) => {
                  const liked = isLiked(article.id);
                  return (
                    <Link
                      key={article.id}
                      href={articleUrl(article)}
                      className="group bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
                    >
                      {/* Top Image */}
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                        {article.imageUrl ? (
                          <img
                            src={getStorageUrl(article.imageUrl)}
                            alt={article.title}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-emerald-50">
                            <BookOpen className="h-10 w-10 text-emerald-300" />
                          </div>
                        )}
                      </div>

                      {/* Card Content Body */}
                      <div className="p-6 flex flex-col justify-between flex-1">
                        <div>
                          {/* Category Badge & Date */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50/90 px-3 py-1 rounded-full uppercase tracking-wider">
                              {article.category || "Market Updates"}
                            </span>
                            <span className="text-[12px] text-slate-400 font-semibold">
                              {formatDate(article.createdAt)}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-emerald-600 transition-colors line-clamp-2 mb-2">
                            {article.title}
                          </h3>

                          {/* Excerpt */}
                          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-6">
                            {getExcerpt(article.content)}
                          </p>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-emerald-600 font-bold text-sm hover:text-emerald-700 inline-flex items-center gap-1.5">
                            Read more <ArrowRight className="w-4 h-4" />
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleLike(article, "article", e);
                              }}
                              aria-label="Like article"
                              title={liked ? "Liked" : "Like"}
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                liked
                                  ? "bg-rose-50 border-rose-200 text-rose-500"
                                  : "border-slate-200/80 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <Heart
                                className={`w-4 h-4 transition-transform active:scale-125 ${
                                  liked ? "fill-rose-500 text-rose-500" : ""
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleShare(article, e)}
                              aria-label="Share article"
                              className="w-9 h-9 rounded-xl border border-slate-200/80 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-all"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <aside className="w-full lg:w-[360px] xl:w-[380px] shrink-0 sticky top-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-slate-900">Popular Articles</h2>
              <Link
                href="/articles"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 hover:underline"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Popular Articles List Card */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-5 shadow-[0_4px_24px_rgb(0,0,0,0.02)] space-y-4 divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4 pt-3 first:pt-0">
                    <Skeleton className="w-20 h-16 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 my-auto">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : popularArticles.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No popular articles yet.</p>
              ) : (
                popularArticles.map((art, index) => (
                  <Link
                    key={art.id}
                    href={articleUrl(art)}
                    className={`flex gap-4 items-center group ${index === 0 ? 'pt-0' : 'pt-4'}`}
                  >
                    <div className="relative w-20 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                      {art.imageUrl ? (
                        <img
                          src={getStorageUrl(art.imageUrl)}
                          alt={art.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-emerald-50">
                          <BookOpen className="w-5 h-5 text-emerald-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-emerald-600 transition-colors">
                        {art.title}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold mt-1">
                        {formatDate(art.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Newsletter Stay Updated Banner */}
            <div className="bg-[#f0fdf4]/80 border border-emerald-100 rounded-[20px] p-5 mt-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Stay Updated</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Subscribe to our newsletter for the latest insights and market updates.
              </p>
              
              {subscribed ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 py-1.5 px-3 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Subscribed!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubscribed(true)}
                  className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700 mt-3 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  Subscribe now <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── SLIDE-OVER FILTER DRAWER ── */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
            onClick={() => setIsFilterDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-slate-900">Filters</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="w-9 h-9 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6 divide-y divide-slate-100">
                
                {/* Section 1: Category Checkboxes */}
                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSections((prev) => ({ ...prev, category: !prev.category }))}
                  >
                    <h3 className="text-sm font-extrabold text-slate-900">Category</h3>
                    <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${openSections.category ? '' : 'rotate-180'}`} />
                  </div>

                  {openSections.category && (
                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={category === "all"}
                          onChange={() => setCategory("all")}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        All Categories
                      </label>

                      {(categories && categories.length > 0 ? categories : [
                        "Market Updates",
                        "IPO Insights",
                        "Company Analysis",
                        "Guides & Education",
                        "Regulatory Updates",
                        "Expert Opinions"
                      ]).map((cat) => (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={category === cat}
                            onChange={() => setCategory(category === cat ? "all" : cat)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Date Range */}
                <div className="pt-6 space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSections((prev) => ({ ...prev, date: !prev.date }))}
                  >
                    <h3 className="text-sm font-extrabold text-slate-900">Date Range</h3>
                    <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${openSections.date ? '' : 'rotate-180'}`} />
                  </div>

                  {openSections.date && (
                    <div className="space-y-3 pt-1">
                      <DatePickerWithRange
                        date={dateRange}
                        setDate={setDateRange}
                        placeholder="Select custom date range"
                        className="w-full [&_button]:h-11 [&_button]:w-full [&_button]:border-slate-200 [&_button]:rounded-xl text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Section 3: Sort By */}
                <div className="pt-6 space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setOpenSections((prev) => ({ ...prev, sort: !prev.sort }))}
                  >
                    <h3 className="text-sm font-extrabold text-slate-900">Sort By</h3>
                    <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${openSections.sort ? '' : 'rotate-180'}`} />
                  </div>

                  {openSections.sort && (
                    <div className="pt-1">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white w-full text-sm font-medium">
                          <SelectValue placeholder="Latest First" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Latest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-100 flex items-center gap-3 bg-white">
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="w-28 h-11 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                >
                  Reset
                </Button>

                <Button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="flex-1 h-11 bg-[#057A55] hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 shadow-md shadow-emerald-600/20"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
