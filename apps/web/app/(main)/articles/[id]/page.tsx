/**
 * Article Detail Page (Public Route)
 *
 * Strategy: Server Component + client islands.
 * - Article data, hero, body, and suggestions are server-rendered (in HTML
 *   source, readable by AI crawlers without JS).
 * - Scroll progress, like toggle, and share bar are client islands
 *   (need window/navigator APIs).
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { constructMetadata } from "@/lib/seo-helper";
import { getAllArticles, findArticleBySlug } from "@/lib/content-api";
import { articleUrl } from "@/lib/slugify";
import { getStorageUrl } from "@/lib/utils";
import type { Article } from "@/types/content";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { ArticleScrollProgress } from "@/components/content/ArticleScrollProgress";
import { ContentLikeButton } from "@/components/content/ArticleLikeButton";
import { ArticleShareBar } from "@/components/content/ArticleShareBar";

interface ArticleDetailPageProps {
  params: Promise<{ id: string }>;
}

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

function readTime(content: string) {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 225));
}

/* ------------------------------------------------------------------ */
/*  Suggestion Card (server-rendered, uses <Link> for navigation)      */
/* ------------------------------------------------------------------ */
function SuggestionCard({ item }: { item: any }) {
  return (
    <Link
      href={articleUrl(item)}
      className="group cursor-pointer flex gap-4 sm:gap-6 py-6 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-all rounded-xl sm:px-4 sm:-mx-4 block"
    >
      {/* Thumbnail */}
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {item.imageUrl ? (
          <img
            src={getStorageUrl(item.imageUrl)}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-emerald-50">
            <BookOpen className="h-6 w-6 text-emerald-200" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">
          Article
        </span>
        <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {item.title}
        </h3>
        <p className="mt-2 text-xs text-gray-400 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {shortDate(item.createdAt)}
          </span>
          <span className="h-1 w-1 rounded-full bg-gray-200" />
          <span>{readTime(item.content)} min read</span>
        </p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { id: slug } = await params;

  let articleItem;
  try {
    const allArticles = await getAllArticles();
    articleItem = findArticleBySlug(allArticles, slug);
  } catch (e) {
    // ignore
  }

  const fallbackDescription = articleItem
    ? articleItem.content.replace(/<[^>]*>/g, "").slice(0, 150) + "..."
    : "Read the latest insights and analysis from UnlistedStox.";

  return constructMetadata(`/articles/${slug}`, {
    title: articleItem ? `${articleItem.title} | UnlistedStox Articles` : "Article | UnlistedStox",
    description: articleItem?.summary || fallbackDescription,
    image: articleItem?.imageUrl || undefined,
  });
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id: slug } = await params;

  // Fetch all articles server-side and resolve by slug / id.
  let allArticles: Article[] = [];
  try {
    allArticles = await getAllArticles();
  } catch {
    allArticles = [];
  }

  const article = findArticleBySlug(allArticles, slug);

  /* ── Not found ── */
  if (!article) {
    notFound();
  }

  const suggestions = allArticles.filter((a) => a.id !== article.id).slice(0, 3);
  const minutes = readTime(article.content);

  // Answer-engine blocks come from the CMS. Editors own these fields; the
  // Article Body is prose only, so the same answer never appears twice.
  const keyFacts = article.keyFacts ?? [];
  const faqs = article.faqs ?? [];
  const hasAnswerBlock = Boolean(article.summary) || keyFacts.length > 0;
  const heroAuthorName = article.authorName || "Editorial Team";
  const heroAuthorRole = article.authorRole || "Expert Analysis";

  return (
    <div className="min-h-screen bg-white selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden w-full max-w-full">
      <ArticleScrollProgress />

      <div className="relative w-full h-[50vh] sm:h-[65vh] lg:h-[75vh] overflow-hidden bg-gray-900">
        {article.imageUrl ? (
          <img
            src={getStorageUrl(article.imageUrl)}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover opacity-60 scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950 to-emerald-900 opacity-80" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 sm:px-8 py-4 sm:py-6 max-w-full overflow-hidden">
          <Link
            href="/articles"
            className="flex items-center gap-1.5"
          >
            <Button
              variant="ghost"
              size="sm"
              className="group gap-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-full px-3 sm:px-4 backdrop-blur-md shrink-0"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline text-sm font-medium">Articles</span>
            </Button>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ContentLikeButton item={article} contentType="article" size="sm" />
            <ArticleShareBar
              article={article}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-12 sm:pb-24">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-[10px] sm:text-xs font-bold text-white uppercase tracking-[0.15em] shadow-lg shadow-emerald-500/30">
                <BookOpen className="h-3 w-3" />
                In-depth Review
              </span>
              <span className="text-xs sm:text-sm font-medium text-white/80 backdrop-blur-md bg-black/20 px-3 py-1 rounded-full flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {minutes} min read
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight drop-shadow-2xl">
              {article.title}
            </h1>
            <div className="mt-8 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex items-center justify-center text-white backdrop-blur-md font-bold text-xs ring-4 ring-black/10">
                  SMC
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{heroAuthorName}</p>
                  <p className="text-[11px] text-white/60">{heroAuthorRole}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-white/20 hidden sm:block" />
              <div className="hidden sm:flex flex-col">
                <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold mb-1">
                  Published
                </p>
                <time className="text-xs font-medium text-white/90">
                  {formatDate(article.createdAt)}
                </time>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(hasAnswerBlock || faqs.length > 0 || article.authorName) && (
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Answer-first summary — extractable by AI crawlers */}
          {hasAnswerBlock && (
            <section
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 mb-10 sm:mb-12"
            >
              {article.summary && (
                <>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                    Quick Answer
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-sm sm:text-base mb-6">
                    {article.summary}
                  </p>
                </>
              )}

              {/* Key facts table */}
              {keyFacts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                        <th className="px-4 py-3 text-left border-b border-slate-200">Attribute</th>
                        <th className="px-4 py-3 text-left border-b border-slate-200">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {keyFacts.map((fact, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {fact.label}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{fact.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Author + review info */}
          {article.authorName && (
            <div className="flex items-start gap-4 mb-10 sm:mb-12">
              <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                SMC
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">
                  {article.authorName}
                </p>
                {article.authorRole && (
                  <p className="text-xs text-gray-500">{article.authorRole}</p>
                )}
                {article.authorBio && (
                  <p className="text-xs text-gray-500 mt-1">{article.authorBio}</p>
                )}
                {(article.reviewedBy || article.contentReviewedAt) && (
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                    {article.reviewedBy && <>Reviewed by {article.reviewedBy}</>}
                    {article.reviewedBy && article.contentReviewedAt && " · "}
                    {article.contentReviewedAt && (
                      <>Last reviewed {formatDate(article.contentReviewedAt)}</>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* FAQ block */}
          {faqs.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 mb-10 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <details
                    key={faq.id ?? i}
                    className="border-b border-slate-100 last:border-0 pb-4"
                  >
                    <summary
                      className="flex items-center justify-between py-2 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer list-none hover:text-emerald-600"
                    >
                      <span>{faq.question}</span>
                      <span className="text-slate-400">▾</span>
                    </summary>
                    <p className="text-xs sm:text-sm text-gray-600 mt-2 pl-1 leading-relaxed">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="relative z-10 -mt-8 sm:-mt-16 bg-white rounded-t-[32px] sm:rounded-t-[48px] shadow-[0_-20px_40px_rgba(0,0,0,0.05)] border-t border-gray-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-20">
          <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-12 border-b border-gray-100">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-500" />
                {formatDate(article.createdAt)}
              </span>
              <span className="h-1 w-1 rounded-full bg-gray-200" />
              <span className="bg-gray-50 px-3 py-1 rounded-full text-xs font-bold text-gray-400">
                PUBLIC ACCESS
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <ContentLikeButton item={article} contentType="article" size="md" />
              <ArticleShareBar
                article={article}
                className="flex items-center gap-3 flex-wrap"
              />
            </div>
          </div>

          <div
            className="prose prose-emerald prose-lg max-w-none overflow-x-hidden break-words [word-break:break-word] prose-img:max-w-full prose-img:h-auto prose-table:overflow-x-auto prose-table:block
              prose-headings:text-gray-900 prose-headings:font-black prose-headings:tracking-tight
              prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mb-8 prose-h2:mt-12
              prose-p:text-gray-600 prose-p:leading-[1.8] prose-p:text-[16px] sm:prose-p:text-[18px]
              prose-a:text-emerald-600 prose-a:font-bold prose-a:underline-offset-4 hover:prose-a:text-emerald-700
              prose-img:rounded-3xl prose-img:shadow-2xl prose-img:border prose-img:border-gray-100
              prose-strong:text-gray-900 prose-strong:font-black
              prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/30 prose-blockquote:py-4 prose-blockquote:px-8 prose-blockquote:rounded-r-2xl prose-blockquote:text-gray-900 prose-blockquote:not-italic prose-blockquote:font-medium prose-blockquote:text-xl
              prose-hr:border-gray-100 prose-hr:my-16"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(article.content),
            }}
          />
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="bg-gray-50/50 py-20 sm:py-32">
          <div className="max-w-4xl mx-auto px-5 sm:px-8">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  Continue Reading
                </h2>
                <div className="h-1 w-12 bg-emerald-500 rounded-full" />
              </div>
              <Link
                href="/articles"
                className="text-emerald-600 hover:text-emerald-700 font-bold group"
              >
                All Articles
                <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-2">
              {suggestions.map((item) => (
                <SuggestionCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
