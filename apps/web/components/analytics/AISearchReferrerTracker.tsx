"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * AI Search Referrer Tracker (client island)
 *
 * Detects traffic arriving from AI answer engines (ChatGPT, Perplexity,
 * Copilot, Gemini) via document.referrer and pushes a GTM dataLayer event.
 * This pairs with docs/ai-search/prompt-baseline.md as the "plumbing is
 * fixed" signal — crawl coverage + referral traffic.
 *
 * AI referrer patterns matched:
 *   chatgpt.com, perplexity.ai, copilot.microsoft.com, gemini.google.com,
 *   bard.google.com, you.com, phind.com, komo.ai, brave.com/search
 *
 * Note: this deliberately avoids `useSearchParams()`. This component is
 * mounted in the root layout, and `useSearchParams()` opts every page out of
 * static prerendering unless it sits behind a Suspense boundary. The query
 * string is readable from `window.location` at effect time instead.
 */
const AI_REFERRER_PATTERNS = [
  "chatgpt.com",
  "perplexity.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "bard.google.com",
  "you.com",
  "phind.com",
  "komo.ai",
  "brave.com/search",
];

function isAiReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return AI_REFERRER_PATTERNS.some((p) => host.includes(p));
  } catch {
    return false;
  }
}

export function AISearchReferrerTracker() {
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    const referrer = document.referrer;
    if (!isAiReferrer(referrer)) return;

    try {
      const host = new URL(referrer).hostname.toLowerCase();

      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "ai_search_referrer",
          ai_platform: host,
          referrer_url: referrer,
          page_path: `${pathname}${window.location.search}`,
          page_title: document.title,
          timestamp: new Date().toISOString(),
        });
      }

      firedRef.current = true;
    } catch {
      // Referrer parsing failed — silently ignore
    }
  }, [pathname]);

  return null;
}
