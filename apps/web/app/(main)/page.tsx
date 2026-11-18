import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchHomeData } from "@/lib/query-prefetch";
import HomeClient from "@/components/home/HomeClient";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { constructMetadata, getSeoMetadataByPath } from "@/lib/seo-helper";
import { SEO_ROUTES } from "@/lib/seo-config";
import { getAllFaqs } from "@/lib/faqs-api";
import { JsonLd } from "@/components/seo/JsonLd";

// Rendering Strategy: ISR (Incremental Static Regeneration)
// This provides:
// 1. Pre-rendered HTML data (SEO)
// 2. Fast first paint with real data (No layout shift)
// 3. Background revalidation every 60 seconds
export const revalidate = 60;

export async function generateMetadata() {
  const config = SEO_ROUTES["/"];
  return constructMetadata("/", {
    title: config?.title,
    description: config?.description,
  });
}

export default async function Home() {
  const dehydratedState = await prefetchHomeData();
  const seo = await getSeoMetadataByPath("/");

  // Server-rendered FAQPage JSON-LD so crawlers can read FAQ answers without JS.
  let faqs: any[] = [];
  try {
    faqs = await getAllFaqs();
  } catch {
    faqs = [];
  }
  const activeFaqs = (faqs || []).filter((f) => f.isActive !== false);
  const faqJsonLd =
    activeFaqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: activeFaqs.map((f) => ({
            "@type": "Question",
            name: f.title,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }
      : null;

  return (
    <>
      {seo?.schemaMarkup && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: seo.schemaMarkup }} />
      )}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <HydrationBoundary state={dehydratedState}>
      <ErrorBoundary>
        <HomeClient />
      </ErrorBoundary>
    </HydrationBoundary>
    </>
  );
}
