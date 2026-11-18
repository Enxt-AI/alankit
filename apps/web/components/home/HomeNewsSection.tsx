"use client";

import Link from "next/link";
import { useNews, useArticles } from "@/hooks/use-content";
import { getStorageUrl, cn } from "@/lib/utils";
import { newsUrl, articleUrl } from "@/lib/slugify";
import { RiArrowRightSLine, RiArticleLine, RiPieChart2Line, RiBookReadLine } from "react-icons/ri";
import { Skeleton } from "@/components/ui/skeleton";
import type { News, Article } from "@/types/content";

export function HomeNewsSection() {
  const { data: news, isLoading: newsLoading } = useNews();
  const { data: articles, isLoading: articlesLoading } = useArticles();

  // Limit to 4 items for the homepage
  const displayNews = (news || []).slice(0, 4);
  const displayArticles = (articles || []).slice(0, 4);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const getCategoryName = (category: any): string => {
    if (!category) return "";
    if (typeof category === "object") return category.name || "";
    return category;
  };

  const getReadingTime = (content: string) => {
    if (!content) return "5";
    const wordCount = content.replace(/<[^>]*>?/gm, '').split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200)).toString();
  };

  // Helper to assign different icons based on category (fallback to article line)
  const getArticleIcon = (category: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("guide") || cat.includes("beginner")) return <RiBookReadLine className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />;
    if (cat.includes("analysis") || cat.includes("market")) return <RiPieChart2Line className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />;
    return <RiArticleLine className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />;
  };

  return (
    <section className="py-6 sm:py-10 md:py-16 px-4 sm:px-6 lg:px-8">
      {/* Latest News Section */}
      <div className="mb-8 sm:mb-12">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Latest News</h2>
          <Link
            href="/news"
            className="flex items-center text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            View All <RiArrowRightSLine className="w-4 h-4 ml-0.5" />
          </Link>
        </div>

        {newsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full">
                <Skeleton className="h-[180px] sm:h-[200px] w-full rounded-xl sm:rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {displayNews.map((item: News) => (
              <Link
                key={item.id}
                href={newsUrl(item.title)}
                className="group relative w-full border border-gray-100 rounded-xl sm:rounded-2xl bg-white shadow-xs sm:shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Image & Badge */}
                <div className="relative h-[135px] sm:h-[160px] w-full overflow-hidden bg-gray-100">
                  {item.imageUrl ? (
                    <img
                      src={getStorageUrl(item.imageUrl)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <RiArticleLine className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
                    </div>
                  )}
                  {item.category && (
                    <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">
                      {getCategoryName(item.category)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3.5 sm:p-5 flex flex-col flex-1">
                  <h3 className="text-[13px] sm:text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-2 sm:mb-3 group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </h3>
                  <div className="mt-auto flex items-center text-[11px] sm:text-xs text-gray-400 font-medium">
                    <span>{formatDate(item.createdAt)}</span>
                    <span className="mx-1.5 sm:mx-2">•</span>
                    <span>{getReadingTime(item.content)} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Featured Articles Section */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Featured Articles</h2>
          <Link
            href="/articles"
            className="flex items-center text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            View All <RiArrowRightSLine className="w-4 h-4 ml-0.5" />
          </Link>
        </div>

        {articlesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full">
                <Skeleton className="h-[75px] sm:h-[90px] w-full rounded-xl sm:rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {displayArticles.map((item: Article) => (
              <Link
                key={item.id}
                href={articleUrl(item)}
                className="group relative w-full border border-gray-100 rounded-xl sm:rounded-2xl bg-white shadow-xs sm:shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-300 p-2.5 sm:p-4 flex items-center gap-3 sm:gap-4"
              >
                {/* Icon Container */}
                <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50 group-hover:bg-emerald-100 transition-colors">
                  {getArticleIcon(getCategoryName(item.category))}
                </div>

                {/* Content */}
                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                  <h3 className="text-[13px] sm:text-[14px] md:text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-1 group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center text-[11px] sm:text-xs text-gray-400 font-medium truncate">
                    <span className="truncate max-w-[120px]">{getCategoryName(item.category) || "Article"}</span>
                    <span className="mx-1.5 shrink-0">•</span>
                    <span className="shrink-0">{getReadingTime(item.content)} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {/* CSS to hide scrollbar but keep functionality */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </section>
  );
}
