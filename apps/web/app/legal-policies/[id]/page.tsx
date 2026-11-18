/**
 * Legal & Policies — Dynamic Page
 *
 * Server Component that fetches a specific legal/policy page from the CMS
 * backend via its slug. Renders the CMS-managed HTML content with Tailwind
 * Typography (prose) classes, or shows a friendly fallback when the page
 * has not yet been published.
 *
 * Replaces the previous client-side PDF.js renderer with the same
 * server-side fetch + on-demand revalidation pattern used by the About Us page.
 *
 * Route: /legal-policies/[id]
 * Examples:
 *   /legal-policies/privacy-policy
 *   /legal-policies/terms-and-conditions
 *   /legal-policies/disclaimer
 */

import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchStaticPageBySlug } from "@/lib/static-pages-server";
import LegalFallback from "./LegalFallback";
import { constructMetadata } from "@/lib/seo-helper";
import { formatDate } from "@/lib/utils";
import { 
  FileText, 
  Shield, 
  AlertTriangle, 
  Cookie, 
  Ban, 
  Receipt, 
  ChevronLeft, 
  Calendar 
} from "lucide-react";

// ---------------------------------------------------------------------------
// Known Legal & Policies pages
// ---------------------------------------------------------------------------

/**
 * Maps the URL segment ([id]) to a human-readable title and the CMS slug
 * used by the backend. Currently all URL IDs match their CMS slugs, but
 * this map decouples the two so they can diverge in the future.
 */
const LEGAL_PAGES: Record<string, { title: string; slug: string }> = {
  "terms-and-conditions": {
    title: "Terms & Conditions",
    slug: "terms-and-conditions",
  },
  "privacy-policy": {
    title: "Privacy Policy",
    slug: "privacy-policy",
  },
  disclaimer: {
    title: "Disclaimer",
    slug: "disclaimer",
  },
  "cookie-policy": {
    title: "Cookie Policy",
    slug: "cookie-policy",
  },
  "acceptable-use": {
    title: "Acceptable Use",
    slug: "acceptable-use",
  },
  "refund-policy": {
    title: "Refund Policy",
    slug: "refund-policy",
  },
};

const ICON_MAP: Record<string, any> = {
  "terms-and-conditions": FileText,
  "privacy-policy": Shield,
  "disclaimer": AlertTriangle,
  "cookie-policy": Cookie,
  "acceptable-use": Ban,
  "refund-policy": Receipt,
};

// ---------------------------------------------------------------------------
// Dynamic Metadata
// ---------------------------------------------------------------------------

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Generates page metadata from CMS fields (metaTitle, metaDescription).
 * Falls back to the static title from LEGAL_PAGES if CMS data is unavailable.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = LEGAL_PAGES[id];

  // Unknown URL segment → Next.js will render notFound() in the component
  if (!entry) return { title: "Page Not Found" };

  const page = await fetchStaticPageBySlug(entry.slug);

  if (!page) {
    return constructMetadata(`/legal-policies/${id}`, {
      title: entry.title,
      description: `Read the ${entry.title.toLowerCase()} for UnlistedStox.`,
    });
  }

  const rawTitle = page.metaTitle ?? page.title;
  const cleanTitle = rawTitle.replace(/\s*\|\s*UnlistedStox\s*$/i, "");

  return constructMetadata(`/legal-policies/${id}`, {
    title: cleanTitle,
    description: page.metaDescription ?? `Read the ${entry.title.toLowerCase()} for UnlistedStox.`,
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

/**
 * Async Server Component for individual Legal & Policies pages.
 *
 * Flow:
 * 1. Resolve the [id] param and look it up in LEGAL_PAGES.
 * 2. If the URL segment is unknown → trigger Next.js 404.
 * 3. Fetch CMS content via fetchStaticPageBySlug().
 * 4. If no CMS content → render <LegalFallback />.
 * 5. Otherwise → render the CMS HTML with prose styling.
 */
export default async function LegalPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = LEGAL_PAGES[id];

  // Unknown URL segment — show Next.js 404
  if (!entry) notFound();

  // Fetch CMS-managed content from the stocks-service
  const page = await fetchStaticPageBySlug(entry.slug);

  // No published content yet — show the "coming soon" fallback
  if (!page) return <LegalFallback title={entry.title} />;

  const ActiveIcon = ICON_MAP[id] || FileText;

  return (
    <div className="min-h-screen bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Navigation / Back link */}
        <div className="mb-8">
          <Link
            href="/legal-policies"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-600 transition-colors duration-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Legal &amp; Policies
          </Link>
        </div>

        {/* Scrollable horizontal capsule navigation on Mobile / Tablet */}
        <div className="lg:hidden flex gap-2.5 overflow-x-auto pb-4 mb-8 -mx-4 px-4 scrollbar-none">
          {Object.entries(LEGAL_PAGES).map(([key, pageItem]) => {
            const Icon = ICON_MAP[key] || FileText;
            const isActive = id === key;
            return (
              <Link
                key={key}
                href={`/legal-policies/${key}`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0
                  ${isActive 
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" 
                    : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {pageItem.title}
              </Link>
            );
          })}
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Sticky Sidebar (Desktop only) */}
          <aside className="lg:col-span-3 sticky top-28 bg-white border border-slate-100/80 rounded-3xl p-6 shadow-sm hidden lg:block">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 px-3">
              Documents
            </h2>
            <nav className="space-y-1.5">
              {Object.entries(LEGAL_PAGES).map(([key, pageItem]) => {
                const Icon = ICON_MAP[key] || FileText;
                const isActive = id === key;
                return (
                  <Link
                    key={key}
                    href={`/legal-policies/${key}`}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200
                      ${isActive 
                        ? "bg-emerald-50 text-emerald-700 font-bold" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                    {pageItem.title}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Legal Content Container */}
          <main className="lg:col-span-9 bg-white border border-slate-100/80 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-8 mb-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                  <ActiveIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {page.title}
                  </h1>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    UnlistedStox official compliance document
                  </p>
                </div>
              </div>
              
              {/* Last Updated badge */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-3.5 py-1.5 self-start sm:self-center shrink-0">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  Updated {page.updatedAt ? formatDate(page.updatedAt) : "Recently"}
                </span>
              </div>
            </div>

            {/* CMS-managed HTML content (Tailwind Typography) */}
            <div
              className="prose prose-slate max-w-none 
                prose-headings:font-black prose-headings:text-slate-900 prose-headings:tracking-tight
                prose-h2:text-2xl prose-h2:font-extrabold prose-h2:mt-10 prose-h2:mb-4
                prose-p:text-slate-600 prose-p:text-[15px] prose-p:leading-relaxed prose-p:mb-5
                prose-li:text-slate-600 prose-li:text-[15px] prose-li:leading-relaxed
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-a:text-emerald-600 prose-a:underline hover:prose-a:text-emerald-700 transition-colors"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </main>
        </div>

      </div>
    </div>
  );
}
