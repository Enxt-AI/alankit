import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchNewsData } from "@/lib/query-prefetch";
import NewsClient from "@/components/content/NewsClient";

/**
 * News Listing Page (Public Route)
 * 
 * Strategy: ISR (Incremental Static Regeneration)
 * - revalidate: 1 hour (3600s)
 * - Hydration: Server-side prefetching of news, categories and articles
 */
export const revalidate = 3600; 

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { constructMetadata, getSeoMetadataByPath } from "@/lib/seo-helper";
import { SEO_ROUTES } from "@/lib/seo-config";

export async function generateMetadata() {
  const config = SEO_ROUTES["/news"];
  return constructMetadata("/news", {
    title: config?.title,
    description: config?.description,
  });
}

export default async function NewsPage() {
  const dehydratedState = await prefetchNewsData();
  const seo = await getSeoMetadataByPath("/news");

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
        <NewsClient />
      </ErrorBoundary>
    </HydrationBoundary>
    </>
  );
}
