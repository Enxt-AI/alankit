import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchStockData } from "@/lib/query-prefetch";
import StockDetailsClient from "@/components/stocks/StockDetailsClient";

interface StockDetailsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Stock Details Page (Public Route)
 *
 * Strategy: ISR (Incremental Static Regeneration)
 * - revalidate: 60s
 * - Hydration: Server-side prefetching of specific stock details
 */
export const revalidate = 60;

import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getStockById } from "@/lib/stocks-api";
import { getAllFaqs, getDefaultStockFaqs } from "@/lib/faqs-api";
import { getStockSlug } from "@/lib/utils";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({ params }: StockDetailsPageProps): Promise<Metadata> {
  const { id } = await params;

  let stock;
  try {
    stock = await getStockById(id);
  } catch (e) {
    // ignore
  }

  return constructMetadata(`/stocks/${id}`, {
    title: stock ? `${stock.name} Share Price & Details | UnlistedStox` : "Unlisted Stock Details | UnlistedStox",
    description: stock?.description || "Check the latest unlisted share price, financials, and details.",
    image: stock?.logoUrl || undefined,
  });
}

function stockJsonLd(stock: any) {
  const priceValidUntil = new Date();
  priceValidUntil.setHours(23, 59, 59, 999);

  return {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: stock.name,
    image: stock.logoUrl || undefined,
    description:
      stock.description ||
      `Buy ${stock.name} unlisted shares at ₹${stock.price.toLocaleString("en-IN")} per share on UnlistedStox.`,
    brand: { "@type": "Organization", name: stock.name },
    offers: {
      "@type": "Offer",
      price: stock.price,
      priceCurrency: "INR",
      priceValidUntil: priceValidUntil.toISOString(),
      availability: stock.isActive
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://www.unlistedstox.com/stocks/${getStockSlug(stock)}`,
    },
    identifier: [
      stock.cin
        ? { "@type": "PropertyValue", propertyID: "CIN", value: stock.cin }
        : null,
      stock.isin
        ? { "@type": "PropertyValue", propertyID: "ISIN", value: stock.isin }
        : null,
    ].filter(Boolean),
    mainEntityOfPage: `https://www.unlistedstox.com/stocks/${getStockSlug(stock)}`,
  };
}

function faqJsonLd(stock: any, cmsFaqs: any[]) {
  const defaultFaqs = getDefaultStockFaqs({
    id: stock.id,
    name: stock.name,
    price: stock.price,
    minimumPurchaseQuantity: stock.minimumPurchaseQuantity,
    maximumPurchaseQuantity: stock.maximumPurchaseQuantity,
    cin: stock.cin,
    isin: stock.isin,
  });

  // CMS FAQs take precedence; default FAQs fill gaps (dedupe by title).
  const existingTitles = new Set(
    (cmsFaqs || []).filter((f) => f.isActive !== false).map((f) => f.title.trim().toLowerCase())
  );
  const allFaqs = [
    ...(cmsFaqs || []).filter((f) => f.isActive !== false).map((f) => ({
      title: f.title,
      answer: f.answer,
    })),
    ...defaultFaqs.filter((df) => !existingTitles.has(df.title.trim().toLowerCase())),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export default async function StockDetailsPage({ params }: StockDetailsPageProps) {
  const { id } = await params;

  let stock;
  try {
    stock = await getStockById(id);
  } catch {
    stock = null;
  }

  // CMS FAQs for this stock (server-side so they appear in HTML source)
  let cmsFaqs: any[] = [];
  if (stock) {
    try {
      cmsFaqs = await getAllFaqs({ stockId: stock.id });
    } catch {
      cmsFaqs = [];
    }
  }

  // Prefetch data on the server for TanStack hydration
  const dehydratedState = await prefetchStockData(id);

  return (
    <>
      {stock && <JsonLd data={stockJsonLd(stock)} />}
      {stock && <JsonLd data={faqJsonLd(stock, cmsFaqs)} />}
      <HydrationBoundary state={dehydratedState}>
        <ErrorBoundary>
          <StockDetailsClient id={id} />
        </ErrorBoundary>
      </HydrationBoundary>
    </>
  );
}
