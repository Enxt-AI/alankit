import type { ReactNode } from "react";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type StockItem = {
  id: string;
  ticker: string;
  name: string;
  price: string;
  change: string;
  logo: ReactNode;
};

const trendingStocks: StockItem[] = [
  {
    id: "tatacap",
    ticker: "TATACAP",
    name: "TATA CAPITAL LIMITED",
    price: "₹950",
    change: "+2.15%",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#005BAA]">
        <span className="text-[10px] font-extrabold tracking-tight text-white">
          TATA
        </span>
      </div>
    ),
  },
  {
    id: "nse",
    ticker: "NSE",
    name: "NATIONAL STOCK EXCHANGE INDIA",
    price: "₹6250",
    change: "+1.85%",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100/80">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 3L19 7.5V16.5L12 21L5 16.5V7.5L12 3Z" fill="#EA580C" />
          <path d="M12 3L19 7.5L12 12L5 7.5L12 3Z" fill="#FBBF24" />
          <path d="M12 12L19 7.5V16.5L12 21V12Z" fill="#1E3A8A" />
        </svg>
      </div>
    ),
  },
  {
    id: "hdbfin",
    ticker: "HDBFIN",
    name: "HDB FINANCIAL SERVICES LTD",
    price: "₹1180",
    change: "+3.42%",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#004C8F]">
        <span className="text-[10px] font-extrabold tracking-tight text-white">
          HDB
        </span>
      </div>
    ),
  },
  {
    id: "swiggy",
    ticker: "SWIGGY",
    name: "SWIGGY LIMITED",
    price: "₹460",
    change: "+1.92%",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FC8019]">
        <span className="text-xs font-black text-white">S</span>
      </div>
    ),
  },
];

export function TrendingStocks() {
  return (
    <section className="w-full bg-white pt-14 pb-8 sm:pt-16 sm:pb-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Main Section Title */}
        <ScrollReveal variant="fade-up">
          <h2 className="text-3xl font-normal tracking-tight text-zinc-900 sm:text-[38px]">
            Unlisted Stocks in India
          </h2>
        </ScrollReveal>

        {/* Subsection Title */}
        <div className="mt-10 sm:mt-12">
          <ScrollReveal variant="fade-up" delayMs={100}>
            <h3 className="text-lg font-normal text-zinc-800 sm:text-xl">
              Trending stocks
            </h3>
          </ScrollReveal>

          {/* Stock Cards Grid */}
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trendingStocks.map((stock, idx) => (
              <ScrollReveal
                key={stock.ticker}
                variant="fade-up"
                delayMs={150 + idx * 100}
              >
                <Link
                  href={`/stocks/${stock.id}`}
                  className="flex h-full flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                >
                  {/* Top: Logo + Ticker & Company Name */}
                  <div className="flex items-center gap-3.5">
                    {stock.logo}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 leading-tight">
                        {stock.ticker}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500 uppercase tracking-wide">
                        {stock.name}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Price + Change Badge */}
                  <div className="mt-7 flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">
                      {stock.price}
                    </span>
                    <span className="inline-flex items-center rounded bg-[#4D9A78] px-1.5 py-0.5 text-xs font-medium text-white">
                      {stock.change}
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
