import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchHomeData } from "@/lib/query-prefetch";
import StocksListingClient from "@/components/stocks/StocksListingClient";

/**
 * Stocks Listing Page (Public Route)
 * 
 * Strategy: ISR (Incremental Static Regeneration)
 * - revalidate: 60s
 * - Hydration: Server-side prefetching of regular stocks
 */
export const revalidate = 60; 

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { constructMetadata, getSeoMetadataByPath } from "@/lib/seo-helper";
import { SEO_ROUTES } from "@/lib/seo-config";

export async function generateMetadata() {
  const config = SEO_ROUTES["/stocks"];
  return constructMetadata("/stocks", {
    title: config?.title,
    description: config?.description,
  });
}

export default async function StocksPage() {
  // We use prefetchHomeData because it already prefetches all regular stocks
  const dehydratedState = await prefetchHomeData();
  const seo = await getSeoMetadataByPath("/stocks");

  return (
    <>
      {seo?.schemaMarkup && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: seo.schemaMarkup }} />
      )}
      {seo?.pageContent && (
        <div className="max-w-7xl mx-auto px-4 py-8 prose" dangerouslySetInnerHTML={{ __html: seo.pageContent }} />
      )}
      <HydrationBoundary state={dehydratedState}>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <StocksListingClient />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
    </>
  );
}
