"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNews, useSingleNews } from "@/hooks/use-content";
import { slugify, newsUrl } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Clock,
  ArrowRight,
  Newspaper,
  Share2,
  ChevronRight,
  Check,
  Facebook,
  Twitter,
  Linkedin,
  Heart,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import type { News } from "@/types/content";
import { cn, getStorageUrl } from "@/lib/utils";
import { useLikedContent } from "@/hooks/use-liked-content";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function shortDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function excerpt(content: string, len = 90) {
  const plain = content.replace(/<[^>]*>/g, "");
  return plain.length > len ? plain.slice(0, len) + "…" : plain;
}

function readTime(content: string) {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/* ------------------------------------------------------------------ */
/*  Suggestion Card — horizontal compact                               */
/* ------------------------------------------------------------------ */
function SuggestionCard({
  item,
  onClick,
  index,
}: {
  item: News;
  onClick: () => void;
  index: number;
}) {
  return (
    <article
      onClick={onClick}
      className="group cursor-pointer flex gap-4 sm:gap-5 py-5 border-b border-gray-100 last:border-0"
    >
      {/* Number */}
      <span className="text-3xl sm:text-4xl font-bold text-gray-200 leading-none select-none pt-1 min-w-[28px]">
        0{index + 1}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
          News
        </span>
        <h3 className="mt-1 text-sm sm:text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-gray-400 line-clamp-1">
          {shortDate(item.createdAt)} · {readTime(item.content)} min read
        </p>
      </div>

      {/* Thumbnail */}
      <div className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {item.imageUrl ? (
          <img
            src={getStorageUrl(item.imageUrl)}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Newspaper className="h-5 w-5 text-gray-300" />
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface NewsDetailPageProps {
  params: Promise<{ id: string }>;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function NewsDetailPage({ params }: NewsDetailPageProps) {
  const router = useRouter();
  const { id: slug } = use(params);
  const { data: allNews, isLoading: isAllLoading, isError, error } = useNews();
  const { data: singleNews, isLoading: isSingleLoading } = useSingleNews(slug);
  const [copied, setCopied] = useState(false);

  const isLoading = isAllLoading && isSingleLoading;

  // Find the article whose ID or slugified title matches the URL slug
  const news = useMemo(() => {
    if (singleNews) return singleNews;
    if (!allNews) return undefined;
    return allNews.find(
      (n) => n.id === slug || slugify(n.title) === slug || n.id?.toLowerCase() === slug?.toLowerCase()
    );
  }, [allNews, singleNews, slug]);

  const suggestions = useMemo(() => {
    if (!allNews || !news) return [];
    return allNews.filter((n) => n.id !== news.id).slice(0, 4);
  }, [allNews, news]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = news?.title || "UnlistedStox News";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareSocial = (platform: "facebook" | "twitter" | "linkedin") => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(news?.title || "UnlistedStox News");

    let shareUrl = "";
    if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=450,noopener,noreferrer");
    }
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Skeleton className="h-[50vh] sm:h-[60vh] w-full" />
        <div className="max-w-3xl mx-auto px-5 sm:px-8 -mt-16 relative z-10">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-5 w-40 mb-10" />
          <div className="space-y-3">
            {[88, 92, 85, 90, 82, 87].map((w, i) => (
              <Skeleton
                key={i}
                className="h-4"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (isError || !news) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <Newspaper className="h-7 w-7 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Article Not Found
        </h2>
        <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
          {error?.message ||
            "This article may have been removed or is temporarily unavailable."}
        </p>
        <Button
          onClick={() => router.back()}
          className="gap-2 bg-gray-900 text-white hover:bg-gray-800 rounded-full px-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  const { isLiked, toggleLike } = useLikedContent();
  const liked = news ? isLiked(news.id) : false;
  const minutes = readTime(news.content);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
      <div className="relative w-full h-[50vh] sm:h-[60vh] overflow-hidden bg-gray-900">
        {news.imageUrl ? (
          <img
            src={getStorageUrl(news.imageUrl)}
            alt={news.title}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-gray-900 to-gray-800" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Floating nav */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 sm:px-8 py-3 sm:py-4 max-w-full overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full px-3 sm:px-4 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">News</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => news && toggleLike(news, "news", e)}
              className={cn(
                "gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1.5 backdrop-blur-md transition-colors text-xs sm:text-sm",
                liked
                  ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-rose-400 text-rose-400")} />
              <span className="text-xs sm:text-sm font-medium">{liked ? "Liked" : "Like"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="gap-1 sm:gap-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-full px-2.5 sm:px-3.5 py-1.5 backdrop-blur-md transition-colors text-xs sm:text-sm"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs sm:text-sm font-semibold text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">Share</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-8 sm:pb-12">
          <div>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <span className="inline-block rounded-full bg-emerald-500 px-3 py-1 text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                News
              </span>
              <span className="text-xs sm:text-sm text-white/60">
                {minutes} min read
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
              {news.title}
            </h1>
            <div className="mt-3 sm:mt-4 flex items-center gap-3 text-sm text-white/50">
              <Clock className="h-3.5 w-3.5" />
              <time>{formatDate(news.createdAt)}</time>
            </div>
          </div>
        </div>
      </div>

      <article className="px-4 sm:px-8 py-6 sm:py-14 max-w-full overflow-hidden">
        <div
          className="prose prose-lg max-w-none overflow-x-hidden break-words [word-break:break-word] prose-img:max-w-full prose-img:h-auto prose-table:overflow-x-auto prose-table:block
            prose-headings:text-gray-900 prose-headings:font-bold prose-headings:tracking-tight
            prose-p:text-gray-600 prose-p:leading-[1.85] prose-p:text-[15px] sm:prose-p:text-[16.5px]
            prose-a:text-emerald-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl prose-img:shadow-md
            prose-strong:text-gray-800
            prose-li:text-gray-600 prose-li:leading-relaxed
            prose-blockquote:border-l-emerald-500 prose-blockquote:bg-emerald-50/40 prose-blockquote:py-1 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:text-gray-600 prose-blockquote:not-italic
            prose-hr:border-gray-100"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(news.content),
          }}
        />

        {/* Social Share bar */}
        <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Share Article
            </span>
            <button
              onClick={() => shareSocial("facebook")}
              title="Share on Facebook"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
            >
              <Facebook className="h-4 w-4" />
            </button>
            <button
              onClick={() => shareSocial("twitter")}
              title="Share on Twitter"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
            >
              <Twitter className="h-4 w-4" />
            </button>
            <button
              onClick={() => shareSocial("linkedin")}
              title="Share on LinkedIn"
              className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
            >
              <Linkedin className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={(e) => news && toggleLike(news, "news", e)}
            title={liked ? "Liked" : "Like"}
            className={cn(
              "h-8 px-3.5 flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all",
              liked
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : "bg-gray-50 text-gray-600 hover:bg-rose-50 hover:text-rose-600"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-rose-500 text-rose-500")} />
            <span>{liked ? "Liked" : "Like"}</span>
          </button>
        </div>

        {/* End of article divider */}
        <div className="mt-10 sm:mt-14 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        </div>
      </article>

      {suggestions.length > 0 && (
        <section className="border-t border-gray-100">
          <div className="px-5 sm:px-8 py-10 sm:py-14">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                More to Read
              </h2>
              <button
                onClick={() => router.push("/news")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                See all
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div>
              {suggestions.map((item, i) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  index={i}
                  onClick={() => router.push(newsUrl(item.title))}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
