"use client";

/**
 * ContentCard Component
 *
 * Reusable card for displaying news and blog items
 * Used in carousel, news listing, and blog listing
 */

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Heart, Share2, ArrowRight, Check } from "lucide-react";
import type { News, Article } from "@/types/content";
import { cn, getStorageUrl } from "@/lib/utils";
import { newsUrl, articleUrl } from "@/lib/slugify";
import { useLikedContent } from "@/hooks/use-liked-content";

interface ContentCardProps {
  item: News | Article;
  type: "news" | "article";
  onClick: () => void;
}

export function ContentCard({ item, type, onClick }: ContentCardProps) {
  const { isLiked, toggleLike } = useLikedContent();
  const liked = isLiked(item.id);
  const [copied, setCopied] = useState(false);
  const targetPath = type === "news" ? newsUrl(item.title) : articleUrl(item);

  // Format date as readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Extract excerpt from content (first 150 characters)
  const getExcerpt = (content: string) => {
    const plainText = content.replace(/<[^>]*>/g, ""); // Remove HTML tags
    return plainText.length > 150
      ? plainText.substring(0, 150) + "..."
      : plainText;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    toggleLike(item, type, e);
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined" ? `${window.location.origin}${targetPath}` : "";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: item.title, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (type === "article") {
    return (
      <article
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${type}: ${item.title}`}
        className="group w-full h-full cursor-pointer focus-visible:outline-none flex flex-col"
      >
        <Card
          className={cn(
            "overflow-hidden rounded-2xl border border-slate-100 bg-white hover:shadow-lg transition-all duration-300 w-full h-full flex flex-col justify-between",
          )}
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 shrink-0">
            {item.imageUrl ? (
              <img
                src={getStorageUrl(item.imageUrl)}
                alt={item.title}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <Newspaper className="h-10 w-10 text-gray-300" />
              </div>
            )}
          </div>

          <CardContent className="p-5 flex flex-col justify-between flex-1 gap-4">
            <div className="space-y-2 flex-1 flex flex-col justify-start">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Article
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800 leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-emerald-700 transition-colors">
                <Link href={targetPath} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {item.title}
                </Link>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                {getExcerpt(item.content)}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-400 font-medium shrink-0">
              <Link
                href={targetPath}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1.5 hover:underline"
              >
                Read more <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLikeClick}
                  title={liked ? "Liked" : "Like"}
                  className={cn(
                    "h-9 w-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center transition-all hover:bg-slate-50",
                    liked
                      ? "text-rose-500 border-rose-200 bg-rose-50/50"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Heart
                    className={cn(
                      "h-4 w-4 transition-transform active:scale-125",
                      liked && "fill-rose-500 text-rose-500"
                    )}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleShareClick}
                  title={copied ? "Copied Link!" : "Share"}
                  className={cn(
                    "h-9 w-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center transition-all hover:bg-slate-50",
                    copied
                      ? "text-emerald-600 border-emerald-300 bg-emerald-50/50"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${type}: ${item.title}`}
      className={cn(
        "group w-full h-full cursor-pointer focus-visible:outline-none flex flex-col",
      )}
    >
      <Card className="w-full h-full flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white hover:shadow-lg transition-all duration-300">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 shrink-0">
          {item.imageUrl ? (
            <img
              src={getStorageUrl(item.imageUrl)}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <Newspaper className="h-10 w-10 text-slate-300" />
            </div>
          )}
        </div>

        <CardContent className="p-5 flex flex-col justify-between flex-1 gap-4">
          <div className="space-y-2 flex-1 flex flex-col justify-start">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                News
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {formatDate(item.createdAt)}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-800 leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-emerald-700 transition-colors">
              <Link href={targetPath} onClick={(e) => e.stopPropagation()} className="hover:underline">
                {item.title}
              </Link>
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed min-h-[2.5rem]">
              {getExcerpt(item.content)}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-400 font-medium shrink-0">
            <Link
              href={targetPath}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1.5 hover:underline"
            >
              Read more <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLikeClick}
                title={liked ? "Liked" : "Like"}
                className={cn(
                  "h-9 w-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center transition-all hover:bg-slate-50",
                  liked
                    ? "text-rose-500 border-rose-200 bg-rose-50/50"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-transform active:scale-125",
                    liked && "fill-rose-500 text-rose-500"
                  )}
                />
              </button>

              <button
                type="button"
                onClick={handleShareClick}
                title={copied ? "Copied Link!" : "Share"}
                className={cn(
                  "h-9 w-9 rounded-xl border border-slate-200/80 bg-white flex items-center justify-center transition-all hover:bg-slate-50",
                  copied
                    ? "text-emerald-600 border-emerald-300 bg-emerald-50/50"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
