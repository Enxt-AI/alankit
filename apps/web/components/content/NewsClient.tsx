"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNews, useArticles, useNewsCategories } from "@/hooks/use-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { newsUrl, articleUrl } from "@/lib/slugify";
import { getStorageUrl } from "@/lib/utils";
import { 
  ArrowLeft, Newspaper, Search, LayoutGrid,
  ArrowUpDown, SlidersHorizontal, Compass,
  BookOpen, ArrowRight, Eye, Heart, Filter, X, ChevronUp, Share2, Check
} from "lucide-react";
import type { Article, News } from "@/types/content";

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function excerpt(content: string, len = 90) {
  const plain = content.replace(/<[^>]*>/g, "");
  return plain.length > len ? plain.slice(0, len) + "…" : plain;
}

function ArticleCardItem({ item }: { item: Article }) {
  return (
    <Link
      href={articleUrl(item)}
      className="group flex gap-3 rounded-xl p-2 hover:bg-slate-50 transition-colors duration-200"
    >
      <div className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
        {item.imageUrl ? (
          <img
            src={getStorageUrl(item.imageUrl)}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-green-50">
            <BookOpen className="h-5 w-5 text-green-600" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-green-600 transition-colors leading-snug">
          {item.title}
        </h4>
        <span className="text-[10px] text-slate-400 font-semibold mt-1">
          {formatDate(item.createdAt)}
        </span>
      </div>
    </Link>
  );
}

function NewsCardItem({ item }: { item: News }) {
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined" && navigator.share) {
      navigator.share({
        title: item.title,
        url: window.location.origin + newsUrl(item.title),
      }).catch(() => {});
    } else if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.origin + newsUrl(item.title));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked(!liked);
  };

  return (
    <Link
      href={newsUrl(item.title)}
      className="group bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex flex-row items-center gap-3 sm:gap-4 hover:shadow-md hover:border-emerald-300 transition-all duration-200 overflow-hidden active:scale-[0.99]"
    >
      {/* Thumbnail Image - Fixed dimensions on mobile (w-24 h-24 = 96x96px) */}
      <div className="relative w-24 h-24 sm:w-[170px] sm:h-[120px] md:w-[180px] md:h-[125px] shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100/80">
        {item.imageUrl ? (
          <img
            src={getStorageUrl(item.imageUrl)}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-green-50">
            <Newspaper className="h-6 w-6 text-green-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 self-stretch">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
              {item.category || "News"}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-slate-400">
              {formatDate(item.createdAt)}
            </span>
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-[#1A2530] leading-snug line-clamp-2 group-hover:text-emerald-600 transition-colors">
            {item.title}
          </h3>

          <p className="hidden sm:block text-xs text-slate-500 leading-relaxed line-clamp-2 mt-1">
            {excerpt(item.content)}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1.5 sm:pt-2 mt-auto text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleLike}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                liked ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              }`}
              title="Like news"
              aria-label="Like news"
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="w-7 h-7 rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Share news"
              aria-label="Share news"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <span className="text-[11px] sm:text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-1">
            Read <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function NewsClient() {
  const router = useRouter();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState("newest");

  const [openSections, setOpenSections] = useState({
    category: true,
    date: true,
    sort: true,
  });

  const apiFilters = useMemo(() => ({
    category: category === "all" ? undefined : category,
    startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
    endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
  }), [category, startDate, endDate]);

  const { data: news, isLoading, isError, error } = useNews(apiFilters);
  const { data: categories } = useNewsCategories();
  const { data: articles, isLoading: isArticlesLoading } = useArticles();

  const displayArticles = useMemo(() => articles?.slice(0, 5) ?? [], [articles]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (category !== "all") count++;
    if (startDate || endDate) count++;
    return count;
  }, [category, startDate, endDate]);

  const resetFilters = () => {
    setSearchQuery("");
    setCategory("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSortBy("newest");
  };

  // Local filtering & sorting
  const filteredNews = useMemo(() => {
    let result = news || [];

    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.content?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "newest") {
       result = [...result].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
       result = [...result].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return result;
  }, [news, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-4 sm:py-10 relative">
      <div className="max-w-[1720px] mx-auto px-3.5 sm:px-8 lg:px-12 xl:px-16">
        
        {/* ── HEADER ROW ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-6 mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-0.5 sm:mb-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                <Newspaper className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-[#057A55]" strokeWidth={2} />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1A2530] tracking-tight">
                News & Updates
              </h1>
            </div>
            <p className="text-slate-500 text-xs sm:text-[15px] font-medium pl-10.5 sm:pl-13">
              Latest Headlines &bull; Market Updates &bull; Announcements
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-[280px] lg:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search news, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 sm:h-11 bg-white border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus-visible:ring-emerald-500/20 focus-visible:border-emerald-600 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`relative h-10 sm:h-11 px-3 sm:px-4 border rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all shadow-2xs shrink-0 ${
                activeFiltersCount > 0
                  ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                  : "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── HORIZONTAL CATEGORY CHIPS BAR ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 mb-4 sm:mb-6 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          {(categories && categories.length > 0
            ? ["all", ...categories]
            : [
                "all",
                "Market Updates",
                "IPO Insights",
                "Company Analysis",
                "Guides & Education",
                "Regulatory Updates",
                "Expert Opinions"
              ]
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                category === cat
                  ? "bg-green-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat === "all" ? "All News" : cat}
            </button>
          ))}
        </div>

        {/* ── ACTIVE FILTER PILLS BAR ── */}
        {(category !== "all" || startDate || endDate) && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4 animate-in fade-in duration-300">
            {category !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] sm:text-xs font-bold">
                Category: {category}
                <X
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 cursor-pointer hover:text-emerald-950"
                  onClick={() => setCategory("all")}
                />
              </span>
            )}

            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] sm:text-xs font-bold">
                Date: {startDate ? format(startDate, "MMM d") : "Start"} – {endDate ? format(endDate, "MMM d, yyyy") : "Present"}
                <X
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 cursor-pointer hover:text-emerald-950"
                  onClick={() => { setStartDate(undefined); setEndDate(undefined); }}
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
        <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-3 sm:mb-6">
          Showing {filteredNews.length} {filteredNews.length === 1 ? "news article" : "news articles"}
        </p>

        {/* Content with Articles Sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
          {/* Main News List (Grid) */}
          <div className="flex-1 min-w-0 w-full">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 p-3 sm:p-4 flex gap-3 sm:gap-4">
                    <Skeleton className="w-24 h-24 sm:w-[170px] sm:h-[120px] rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 my-auto">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4 text-center w-full">
                <div className="relative mb-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-full flex items-center justify-center relative">
                    <Newspaper className="w-8 h-8 sm:w-10 sm:h-10 text-[#057A55]" strokeWidth={2} />
                  </div>
                </div>
                <h3 className="text-lg sm:text-[22px] font-bold text-[#1A2530] mb-1.5">No news found</h3>
                <p className="text-slate-500 max-w-[320px] mb-6 leading-relaxed text-xs sm:text-[15px]">
                  We couldn't find any news matching your filters.
                </p>
                <Button
                  variant="outline"
                  className="text-[#057A55] border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-800 h-11 px-5 rounded-xl font-bold flex items-center gap-2 transition-all text-xs sm:text-sm"
                  onClick={resetFilters}
                >
                  <Compass className="w-4 h-4" />
                  Explore All Topics
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
                {filteredNews.map((item) => (
                  <NewsCardItem
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Articles Sidebar */}
          <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 sticky top-24 pt-4 lg:pt-0">
            <div className="flex items-center justify-between mb-3 sm:mb-4 px-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Articles</h2>
              <Link
                href="/articles"
                className="text-xs font-bold text-[#057A55] hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <div className="rounded-2xl sm:rounded-[24px] border border-slate-200/80 bg-white divide-y divide-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] p-3 sm:p-4 space-y-2.5 sm:space-y-3">
              {isArticlesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2">
                    <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2 my-auto">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : displayArticles.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <BookOpen className="h-7 w-7 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No articles yet</p>
                </div>
              ) : (
                displayArticles.map((article, idx) => (
                  <div key={article.id} className={idx === 0 ? "pt-0" : "pt-2.5 sm:pt-3"}>
                    <ArticleCardItem
                      item={article}
                    />
                  </div>
                ))
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500 font-semibold mb-1 block">From</label>
                          <DatePicker
                            date={startDate}
                            setDate={setStartDate}
                            placeholder="Start date"
                            className="h-11 w-full rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 font-semibold mb-1 block">To</label>
                          <DatePicker
                            date={endDate}
                            setDate={setEndDate}
                            placeholder="End date"
                            className="h-11 w-full rounded-xl"
                          />
                        </div>
                      </div>
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
                          <SelectValue placeholder="Newest First" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
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
