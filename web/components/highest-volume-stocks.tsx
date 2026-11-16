import type { ReactNode } from "react";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type VolumeStockItem = {
  id: string;
  name: string;
  ticker: string;
  price: string;
  change: string;
  isPositive: boolean;
  logo: ReactNode;
};

const volumeColumns: VolumeStockItem[][] = [
  // Column 1
  [
    {
      id: "reliance",
      name: "RELIANCE RETAIL VENTURES LTD",
      ticker: "RELIANCE",
      price: "₹2890",
      change: "+1.14%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0F3D3E]">
          <span className="text-[10px] font-extrabold tracking-tight text-[#FBBF24]">
            RIL
          </span>
        </div>
      ),
    },
    {
      id: "hdfcbank",
      name: "HDFC BANK LIMITED",
      ticker: "HDFCBANK",
      price: "₹1745",
      change: "+0.82%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#004C8F]">
          <div className="flex h-5 w-5 items-center justify-center rounded-[3px] border-[1.5px] border-[#ED232A] text-[8px] font-extrabold text-white">
            H
          </div>
        </div>
      ),
    },
    {
      id: "tcs",
      name: "TATA CONSULTANCY SERVICES...",
      ticker: "TCS",
      price: "₹4120",
      change: "-0.45%",
      isPositive: false,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5850EC]/10">
          <span className="text-[10px] font-extrabold tracking-tight text-[#5850EC]">
            TCS
          </span>
        </div>
      ),
    },
    {
      id: "infy",
      name: "INFOSYS LIMITED",
      ticker: "INFY",
      price: "₹1890",
      change: "+1.48%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#007CC3]">
          <span className="text-[10px] font-bold tracking-tight text-white">
            Infy
          </span>
        </div>
      ),
    },
  ],

  // Column 2
  [
    {
      id: "icicibank",
      name: "ICICI BANK LIMITED",
      ticker: "ICICIBANK",
      price: "₹1285",
      change: "+0.95%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F37021]">
          <span className="text-[9px] font-extrabold tracking-tight text-white">
            ICICI
          </span>
        </div>
      ),
    },
    {
      id: "bhartiartl",
      name: "BHARTI AIRTEL LIMITED",
      ticker: "BHARTIARTL",
      price: "₹1640",
      change: "+1.62%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E40000]">
          <span className="text-[10px] font-extrabold text-white">airtel</span>
        </div>
      ),
    },
    {
      id: "sbin",
      name: "STATE BANK OF INDIA",
      ticker: "SBIN",
      price: "₹845",
      change: "-0.64%",
      isPositive: false,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#280071]">
          <span className="text-[10px] font-extrabold text-[#00B5EF]">SBI</span>
        </div>
      ),
    },
    {
      id: "bajfinance",
      name: "BAJAJ FINANCE LIMITED",
      ticker: "BAJFINANCE",
      price: "₹7120",
      change: "-0.88%",
      isPositive: false,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0066B2]">
          <span className="text-[10px] font-extrabold text-white">BAJAJ</span>
        </div>
      ),
    },
  ],

  // Column 3
  [
    {
      id: "nsdl",
      name: "NATIONAL SECURITIES DEPOS...",
      ticker: "NSDL",
      price: "₹1280",
      change: "+1.59%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1E2A4A]">
          <span className="text-[9px] font-extrabold text-white">NSDL</span>
        </div>
      ),
    },
    {
      id: "boat",
      name: "IMAGINE MARKETING (BOAT)",
      ticker: "BOAT",
      price: "₹1450",
      change: "+2.84%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E11D48]">
          <span className="text-[10px] font-black tracking-tight text-white">
            boAt
          </span>
        </div>
      ),
    },
    {
      id: "lt",
      name: "LARSEN & TOUBRO LIMITED",
      ticker: "LT",
      price: "₹3580",
      change: "+1.32%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
          <span className="text-xs font-bold text-[#5850EC]">L&amp;T</span>
        </div>
      ),
    },
    {
      id: "itc",
      name: "ITC LIMITED",
      ticker: "ITC",
      price: "₹495",
      change: "+0.51%",
      isPositive: true,
      logo: (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
          <span className="text-xs font-bold text-[#5850EC]">ITC</span>
        </div>
      ),
    },
  ],
];

export function HighestVolumeStocks() {
  return (
    <section className="w-full bg-white pb-10 pt-2">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Section Heading */}
        <ScrollReveal variant="fade-up">
          <h3 className="text-lg font-normal text-zinc-800 sm:text-xl">
            Highest volume stocks
          </h3>
        </ScrollReveal>

        {/* 3-Column List Grid */}
        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
          {volumeColumns.map((column, colIdx) => (
            <ScrollReveal
              key={colIdx}
              variant="fade-up"
              delayMs={100 + colIdx * 120}
              className="flex flex-col"
            >
              {column.map((stock) => (
                <Link
                  key={stock.id}
                  href={`/stocks/${stock.id}`}
                  className="flex items-center justify-between gap-4 border-b border-zinc-100 py-4 transition-colors hover:bg-zinc-50/80"
                >
                  {/* Left: Logo + Company Name & Ticker */}
                  <div className="flex min-w-0 items-center gap-3.5">
                    {stock.logo}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-normal text-zinc-900">
                        {stock.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 uppercase">
                        {stock.ticker}
                      </p>
                    </div>
                  </div>

                  {/* Right: Price + Percentage Change Badge */}
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-normal text-zinc-900">
                      {stock.price}
                    </span>
                    <span
                      className={`mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${
                        stock.isPositive ? "bg-[#4D9A78]" : "bg-[#C8524B]"
                      }`}
                    >
                      {stock.change}
                    </span>
                  </div>
                </Link>
              ))}
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
