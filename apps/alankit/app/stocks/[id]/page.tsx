import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StockChart } from "@/components/stock-chart";
import { StockGaugeMeter } from "@/components/stock-gauge-meter";
import { StockDetailsSections } from "@/components/stock-details-sections";
import { RelatedStocksCard } from "@/components/related-stocks-card";
import { StockActions } from "@/components/stock-actions";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  getStockById,
  stocksCatalog,
  type StockDetail,
} from "@/lib/stocks-data";

export function generateStaticParams() {
  return stocksCatalog.map((stock) => ({
    id: stock.id,
  }));
}

function StockAvatar({ stock }: { stock: StockDetail }) {
  if (stock.logoType === "ace") {
    return (
      <div className="flex size-20 sm:size-22 items-center justify-center rounded-full bg-[#005BAA] ring-4 ring-white shadow-sm">
        <span className="text-xl sm:text-2xl font-black tracking-tighter text-white">
          {stock.logoText || "TATA"}
        </span>
      </div>
    );
  }

  if (stock.logoType === "adaro") {
    return (
      <div className="flex size-20 sm:size-22 items-center justify-center rounded-full bg-zinc-100 ring-4 ring-white shadow-sm">
        <svg
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 3L19 7.5V16.5L12 21L5 16.5V7.5L12 3Z" fill="#059669" />
          <path d="M12 3L19 7.5L12 12L5 7.5L12 3Z" fill="#A3E635" />
          <path d="M12 12L19 7.5V16.5L12 21V12Z" fill="#0D9488" />
          <path
            d="M9 10.5L15 8V14.5L9 17V10.5Z"
            fill="#FEF08A"
            opacity="0.85"
          />
        </svg>
      </div>
    );
  }

  if (stock.logoType === "arto") {
    return (
      <div className="flex size-20 sm:size-22 items-center justify-center rounded-full bg-zinc-100 ring-4 ring-white shadow-sm">
        <svg
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="9" cy="6.5" r="1.5" fill="#F59E0B" />
          <circle cx="12.5" cy="6.5" r="1.5" fill="#F59E0B" />
          <circle cx="16" cy="6.5" r="1.5" fill="#F59E0B" />
          <path
            d="M15.5 10V15C15.5 17.4853 13.4853 19.5 11 19.5C8.79086 19.5 7 17.7091 7 15.5V14.5"
            stroke="#F59E0B"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M12.5 10H15.5"
            stroke="#F59E0B"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (stock.logoType === "goto") {
    return (
      <div className="flex size-20 sm:size-22 items-center justify-center rounded-full bg-zinc-100 ring-4 ring-white shadow-sm">
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" fill="#00AA13" />
          <path
            d="M12 16.5C9.51472 16.5 7.5 14.4853 7.5 12C7.5 9.51472 9.51472 7.5 12 7.5C14.4853 7.5 16.5 9.51472 16.5 12C16.5 13.3 15.95 14.47 15.07 15.3"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="2" fill="white" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex size-20 sm:size-22 items-center justify-center rounded-full bg-[#4F46E5] ring-4 ring-white shadow-sm">
      <span className="text-2xl font-bold text-white">
        {stock.initial || stock.ticker.charAt(0)}
      </span>
    </div>
  );
}

async function StockDetailsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stock = getStockById(id);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      {/* Overlapping Circular Stock Logo */}
      <div className="relative z-10 -mt-10 sm:-mt-11 inline-block">
        <StockAvatar stock={stock} />
      </div>

      {/* 2-Column Layout: Left (Header + Chart + Key Stats + About + News) | Right (Gauge Meters + Related Stocks) */}
      <div className="mt-6 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
        {/* Left Column */}
        <div className="lg:col-span-8">
          <ScrollReveal variant="fade-up">
            {/* Breadcrumb Navigation */}
            <Breadcrumb className="mb-3">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/" />}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/stocks" />}>
                    Stocks
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{stock.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Ticker Badge + Company Name */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-md bg-[#0E171B] px-2.5 py-1 text-xs font-medium text-white uppercase">
                {stock.ticker}
              </span>
              <h1 className="text-lg font-medium tracking-tight text-zinc-900 uppercase sm:text-xl">
                {stock.name}
              </h1>
            </div>

            {/* Price + Currency + Change */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-medium tracking-tight text-zinc-900 sm:text-[28px]">
                {stock.price}
              </span>
              <span className="text-xs font-medium text-zinc-500 uppercase">
                {stock.currency}
              </span>
              <span
                className={`text-xs sm:text-sm font-medium ${
                  stock.isPositive ? "text-[#4D9A78]" : "text-[#C8524B]"
                }`}
              >
                {stock.changeAmount} ({stock.changePercent})
              </span>
            </div>
            <StockActions stockId={stock.id} ticker={stock.ticker} />
          </ScrollReveal>

          {/* Standalone Stock Graph Component */}
          <ScrollReveal variant="fade-up" delayMs={120} className="mt-6">
            <StockChart
              exchange={stock.exchange}
              lastUpdated={stock.lastUpdated}
              currentPrice={stock.price}
              baseSeries={stock.series1M}
            />
          </ScrollReveal>

          {/* Key Statistics, Filter Tabs, About the Company & News Sections */}
          <StockDetailsSections stock={stock} />
        </div>

        {/* Right Column: Standalone Gauge Meter Components + Related Stocks Card */}
        <div className="space-y-6 lg:col-span-4">
          {/* Technicals Meter */}
          <ScrollReveal variant="fade-left" delayMs={150}>
            <StockGaugeMeter
              title="Technicals"
              description="Summarizes what the indicators suggest."
              ratingLabel={stock.technicalRating.label}
              score={stock.technicalRating.score}
              arcColor={stock.technicalRating.color}
            />
          </ScrollReveal>

          {/* Analyst Rating Meter */}
          <ScrollReveal variant="fade-left" delayMs={260}>
            <StockGaugeMeter
              title="Analyst Rating"
              description="Aggregate view of professional ratings."
              ratingLabel={stock.analystRating.label}
              score={stock.analystRating.score}
              arcColor={stock.analystRating.color}
            />
          </ScrollReveal>

          {/* Related Stocks Card */}
          <ScrollReveal variant="fade-left" delayMs={360}>
            <RelatedStocksCard />
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

function StockDetailsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 animate-pulse">
      <div className="relative z-10 -mt-10 sm:-mt-11 size-20 sm:size-22 rounded-full bg-zinc-200 ring-4 ring-white" />
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="h-7 w-72 rounded bg-zinc-100" />
          <div className="h-9 w-44 rounded bg-zinc-100" />
          <div className="h-72 w-full rounded-xl bg-zinc-100" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="h-56 w-full rounded-xl bg-zinc-100" />
          <div className="h-56 w-full rounded-xl bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

export default function StockDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />

      <main className="flex-1 pb-24">
        {/* Top Dark Banner with Geometric Watermark */}
        <div className="relative h-40 sm:h-48 w-full overflow-hidden bg-[#0E171B]">
          <div
            className="pointer-events-none select-none absolute -right-12 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <svg
              className="size-[320px] sm:size-[420px] text-[#1C262B]"
              viewBox="0 0 400 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g
                stroke="currentColor"
                strokeWidth="34"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="72"
                  y="72"
                  width="128"
                  height="128"
                  rx="48"
                  transform="rotate(-45 136 136)"
                />
                <rect
                  x="200"
                  y="72"
                  width="128"
                  height="128"
                  rx="48"
                  transform="rotate(45 264 136)"
                />
                <rect
                  x="72"
                  y="200"
                  width="128"
                  height="128"
                  rx="48"
                  transform="rotate(45 136 264)"
                />
                <rect
                  x="200"
                  y="200"
                  width="128"
                  height="128"
                  rx="48"
                  transform="rotate(-45 264 264)"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Suspense Boundary for Dynamic Route Params */}
        <Suspense fallback={<StockDetailsSkeleton />}>
          <StockDetailsContent params={params} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
