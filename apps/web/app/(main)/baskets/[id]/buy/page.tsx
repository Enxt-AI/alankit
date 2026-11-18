import BuyBasketPageClient from "@/components/orders/buy-basket-page-client";
import { enforceBuyVerification } from "@/lib/verification-gate";
import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

interface BuyBasketPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: BuyBasketPageProps): Promise<Metadata> {
  const { id } = await params;
  // Gate before metadata streams so unverified visits get a crisp 307
  // instead of a delayed meta-refresh redirect.
  await enforceBuyVerification(`/baskets/${id}/buy`);
  return constructMetadata(`/baskets/${id}/buy`, {
    title: "Invest in Basket | UnlistedStox",
    description: "Purchase diversified unlisted share baskets with secure digital e-Sign.",
  });
}

export default async function BuyBasketPage({ params }: BuyBasketPageProps) {
  const { id } = await params;

  // Hard gate: login (via middleware) + KYC → Demat → Bank chain, evaluated
  // server-side so direct URL entry cannot skip verification.
  await enforceBuyVerification(`/baskets/${id}/buy`);

  return (
    <ErrorBoundary>
      <BuyBasketPageClient id={id} />
    </ErrorBoundary>
  );
}
