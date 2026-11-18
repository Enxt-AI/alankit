"use client";

/**
 * StockNewsSection
 *
 * Compact, card-contained news feed for the stock detail page.
 * - 1 item  : horizontal "featured" row (thumbnail left, content right)
 * - 2+ items: featured lead story + compact list of the remaining stories
 * Visual language matches KeyFundamentals / FinancialMetrics cards.
 */

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Clock, Newspaper } from "lucide-react";
import type { Article, News } from "@/types/content";
import { cn, getStorageUrl } from "@/lib/utils";
import { newsUrl, articleUrl } from "@/lib/slugify";

type ContentType = "news" | "article";
type Item = News | Article;

const THEME = {
  news: {
    Icon: Newspaper,
    title: "Latest News",
    subtitle: "Updates related to",
    unit: ["update", "updates"],
    cta: "Read full story",
    allLabel: "View all news",
    allHref: "/news",
    fallback: "News",
    text: "text-emerald-600",
    hoverText: "group-hover:text-emerald-700",
    iconWrap: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    placeholder: "from-emerald-50",
    placeholderIcon: "text-emerald-300",
    linkHover: "hover:text-emerald-700",
  },
  article: {
    Icon: BookOpen,
    title: "Expert Insights & Analysis",
    subtitle: "In-depth reads on",
    unit: ["article", "articles"],
    cta: "Read article",
    allLabel: "View all articles",
    allHref: "/articles",
    fallback: "Article",
    text: "text-blue-600",
    hoverText: "group-hover:text-blue-700",
    iconWrap: "bg-blue-50 text-blue-600 ring-blue-100",
    pill: "bg-blue-50 text-blue-700 ring-blue-200/70",
    placeholder: "from-blue-50",
    placeholderIcon: "text-blue-300",
    linkHover: "hover:text-blue-700",
  },
} as const;

interface StockNewsSectionProps {
  news?: Item[];
  isLoading?: boolean;
  stockName?: string;
  maxItems?: number;
  type?: ContentType;
}

const toPlainText = (html: string = "") =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();

const excerpt = (html: string, len: number) => {
  const text = toPlainText(html);
  return text.length > len ? `${text.slice(0, len).trimEnd()}…` : text;
};

const formatDate = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

const relativeTime = (d: string) => {
  const diffDays = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(d);
};

const readTime = (html: string) => Math.max(1, Math.round(toPlainText(html).split(" ").length / 200));

function Thumb({ src, alt, className, type }: { src?: string | null; alt: string; className?: string; type: ContentType }) {
  const [failed, setFailed] = useState(false);
  const t = THEME[type];
  return (
    <div className={cn("relative overflow-hidden bg-slate-100 shrink-0", className)}>
      {src && !failed ? (
        <img
          src={getStorageUrl(src)}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br to-slate-100", t.placeholder)}>
          <t.Icon className={cn("h-6 w-6", t.placeholderIcon)} />
        </div>
      )}
    </div>
  );
}

function CategoryPill({ label, type }: { label?: string | null; type: ContentType }) {
  const t = THEME[type];
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset", t.pill)}>
      {label || t.fallback}
    </span>
  );
}

const hrefFor = (item: Item, type: ContentType) => (type === "news" ? newsUrl(item.title) : articleUrl(item));

function FeaturedStory({ item, type }: { item: Item; type: ContentType }) {
  const t = THEME[type];
  const anyItem = item as any;
  return (
    <Link
      href={hrefFor(item, type)}
      className="group flex flex-col sm:flex-row gap-4 sm:gap-5 rounded-xl p-2 -m-2 transition-colors hover:bg-slate-50/80"
    >
      <Thumb
        type={type}
        src={anyItem.imageUrl}
        alt={item.title}
        className="w-full sm:w-64 md:w-72 aspect-[16/9] sm:aspect-[4/3] rounded-lg ring-1 ring-slate-200/70"
      />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <CategoryPill label={anyItem.category} type={type} />
          <span>{relativeTime(anyItem.createdAt)}</span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readTime(anyItem.content)} min read
          </span>
        </div>
        <h3 className={cn("mt-2 text-[15px] sm:text-lg font-semibold leading-snug text-slate-900 line-clamp-2 transition-colors", t.hoverText)}>
          {item.title}
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-3">
          {excerpt(anyItem.content, 220)}
        </p>
        <span className={cn("mt-auto pt-3 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold", t.text)}>
          {t.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function CompactStory({ item, type }: { item: Item; type: ContentType }) {
  const t = THEME[type];
  const anyItem = item as any;
  return (
    <li>
      <Link
        href={hrefFor(item, type)}
        className="group flex items-center gap-3 sm:gap-4 rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-slate-50/80"
      >
        <Thumb type={type} src={anyItem.imageUrl} alt={item.title} className="h-14 w-20 sm:h-16 sm:w-24 rounded-md ring-1 ring-slate-200/70" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500">
            <CategoryPill label={anyItem.category} type={type} />
            <span>{relativeTime(anyItem.createdAt)}</span>
          </div>
          <h4 className={cn("mt-1 text-[13px] sm:text-sm font-semibold leading-snug text-slate-900 line-clamp-2 transition-colors", t.hoverText)}>
            {item.title}
          </h4>
        </div>
        <ArrowUpRight className={cn("h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5", type === "news" ? "group-hover:text-emerald-600" : "group-hover:text-blue-600")} />
      </Link>
    </li>
  );
}
function SkeletonRows() {
  return (
    <div className="flex flex-col sm:flex-row gap-5 animate-pulse">
      <div className="w-full sm:w-72 aspect-[16/9] sm:aspect-[4/3] rounded-lg bg-slate-200/70" />
      <div className="flex-1 space-y-3 py-1">
        <div className="h-3 w-32 rounded bg-slate-200/70" />
        <div className="h-5 w-4/5 rounded bg-slate-200/70" />
        <div className="h-3 w-full rounded bg-slate-200/60" />
        <div className="h-3 w-2/3 rounded bg-slate-200/60" />
      </div>
    </div>
  );
}

export function StockNewsSection({ news, isLoading, stockName, maxItems = 5, type = "news" }: StockNewsSectionProps) {
  const t = THEME[type];
  const items = (news ?? []).slice(0, maxItems);
  if (!isLoading && items.length === 0) return null;

  const [lead, ...rest] = items;
  const total = news?.length ?? 0;
  const headingId = `stock-${type}-heading`;

  return (
    <section
      id={`stock-${type}`}
      aria-labelledby={headingId}
      className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6"
    >
      <header className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1", t.iconWrap)}>
            <t.Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h2 id={headingId} className="text-base sm:text-[18px] font-semibold text-gray-900 leading-tight">
              {t.title}
            </h2>
            {stockName && (
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {t.subtitle} {stockName}
              </p>
            )}
          </div>
        </div>
        {!isLoading && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {total} {total === 1 ? t.unit[0] : t.unit[1]}
          </span>
        )}
      </header>

      {isLoading ? (
        <SkeletonRows />
      ) : (
        <>
          {lead && <FeaturedStory item={lead} type={type} />}
          {rest.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {rest.map((n) => (
                <CompactStory key={n.id} item={n} type={type} />
              ))}
            </ul>
          )}
        </>
      )}

      {!isLoading && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <Link
            href={t.allHref}
            className={cn("inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-600 transition-colors", t.linkHover)}
          >
            {t.allLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

export default StockNewsSection;
