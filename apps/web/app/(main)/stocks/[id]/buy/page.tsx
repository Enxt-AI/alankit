import { HydrationBoundary } from "@tanstack/react-query";
import { prefetchStockData } from "@/lib/query-prefetch";
import { enforceBuyVerification } from "@/lib/verification-gate";
import BuyStockPageClient from "@/components/orders/buy-stock-page-client";
import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getStockById } from "@/lib/stocks-api";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

interface BuyStockPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: BuyStockPageProps): Promise<Metadata> {
  const { id } = await params;
  // Gate before metadata streams so unverified visits get a crisp 307
  // instead of a delayed meta-refresh redirect.
  await enforceBuyVerification(`/stocks/${id}/buy`);
  
  let stock;
  try {
    stock = await getStockById(id);
  } catch (e) {
    // ignore
  }

  return constructMetadata(`/stocks/${id}/buy`, {
    title: stock ? `Buy ${stock.name} Unlisted Shares | UnlistedStox` : "Buy Unlisted Shares | UnlistedStox",
    description: stock?.description || "Purchase unlisted shares with secure Aadhaar e-Sign and live volume pricing discounts.",
    image: stock?.logoUrl || undefined,
  });
}

export default async function BuyStockPage({ params }: BuyStockPageProps) {
  const { id } = await params;
  // Hard gate: login (via middleware) + KYC → Demat → Bank chain, evaluated
  // server-side so direct URL entry cannot skip verification.
  await enforceBuyVerification(`/stocks/${id}/buy`);
  const dehydratedState = await prefetchStockData(id);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ErrorBoundary>
        <BuyStockPageClient id={id} />
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
