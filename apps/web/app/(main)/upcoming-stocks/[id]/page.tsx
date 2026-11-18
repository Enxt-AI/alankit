/**
 * Upcoming Stock Detail Page (Public Route)
 *
 * Strategy: Server Component + client island.
 * - Stock data, price, CIN, and company overview are server-rendered (in HTML
 *   source, readable by AI crawlers without JS).
 * - Watchlist toggle is a client island (needs auth + mutation APIs).
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { constructMetadata } from "@/lib/seo-helper";
import { getUpcomingStockById } from "@/lib/upcoming-stocks-api";
import { getStorageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Building2 } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { JsonLd } from "@/components/seo/JsonLd";
import { UpcomingWatchlistButton } from "@/components/stocks/UpcomingWatchlistButton";

interface UpcomingStockDetailsPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

export async function generateMetadata({ params }: UpcomingStockDetailsPageProps): Promise<Metadata> {
  const { id } = await params;

  let stock;
  try {
    stock = await getUpcomingStockById(id);
  } catch {
    // ignore
  }

  return constructMetadata(`/upcoming-stocks/${id}`, {
    title: stock ? `${stock.name} | UnlistedStox Upcoming` : "Upcoming Stock | UnlistedStox",
    description: stock?.description || "This stock is not available for purchase yet. Add it to your watchlist to track updates.",
    image: stock?.logoUrl || undefined,
  });
}

export default async function UpcomingStockDetailsPage({ params }: UpcomingStockDetailsPageProps) {
  const { id } = await params;

  let stock;
  try {
    stock = await getUpcomingStockById(id);
  } catch {
    stock = null;
  }

  /* ── Not found ── */
  if (!stock) {
    notFound();
  }

  const stockJsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: stock.name,
    image: stock.logoUrl || undefined,
    description:
      stock.description ||
      `${stock.name} is an upcoming unlisted stock. Add it to your watchlist to track updates.`,
    brand: { "@type": "Organization", name: stock.name },
    offers: {
      "@type": "Offer",
      price: stock.price,
      priceCurrency: "INR",
      availability: "https://schema.org/OutOfStock",
      url: `https://www.unlistedstox.com/upcoming-stocks/${stock.id}`,
    },
    identifier: [
      stock.cin ? { "@type": "PropertyValue", propertyID: "CIN", value: stock.cin } : null,
    ].filter(Boolean),
    mainEntityOfPage: `https://www.unlistedstox.com/upcoming-stocks/${stock.id}`,
  };

  return (
    <div className="max-w-[1440px] mx-auto px-10 py-6 space-y-6">
      <JsonLd data={stockJsonLd} />

      <Link href="/upcoming-stocks">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="flex items-center gap-2 text-sm text-gray-500 hover:text-black" />
          Back
        </Button>
      </Link>

      <Alert className="border-none p-5">
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This stock is not available for purchase yet. You can add it to your
          watchlist to track updates.
        </AlertDescription>
      </Alert>

      <div className="border-none shadow-sm rounded-lg bg-white border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="shrink-0 relative h-20 w-20 rounded-lg bg-gray-100 border flex items-center justify-center overflow-hidden">
            {stock.logoUrl ? (
              <img
                src={stock.logoUrl}
                alt={`${stock.name} logo`}
                className="h-full w-full object-contain p-2"
                decoding="async"
              />
            ) : (
              <Building2 className="h-10 w-10 text-gray-400" />
            )}
          </div>

          <div className="flex flex-1 flex-col w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {stock.name}
                </h1>
                <p className="text-sm font-medium text-gray-500">
                  CIN: {stock.cin ?? "—"}
                </p>
              </div>

              <div className="flex flex-col w-full sm:w-auto gap-2">
                <UpcomingWatchlistButton stock={stock} />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                ₹{stock.price.toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-gray-500">per share</span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
              <p>
                Last updated: {formatDate(stock.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {stock.description && (
        <div className="rounded-md border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="text-gray-700">
              <Building2 size={16} strokeWidth={2.5} />
            </div>
            <h2 className="text-[16px] font-semibold text-gray-900">
              Company Overview
            </h2>
          </div>
          <div
            className="text-[14px] text-gray-500 leading-relaxed font-normal prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(stock.description),
            }}
          />
        </div>
      )}
    </div>
  );
}
