import type { ReactNode } from "react";
import Link from "next/link";

type RelatedStockItem = {
  id: string;
  name: string;
  ticker: string;
  price: string;
  change: string;
  isPositive: boolean;
  logo: ReactNode;
};

const relatedStocks: RelatedStockItem[] = [
  {
    id: "tatacap",
    name: "TATA CAPITAL LIMITED",
    ticker: "TATACAP",
    price: "₹950",
    change: "+2.15%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#005BAA]">
        <span className="text-[8px] font-extrabold tracking-tight text-white">
          TATA
        </span>
      </div>
    ),
  },
  {
    id: "nse",
    name: "NATIONAL STOCK EXCHANGE...",
    ticker: "NSE",
    price: "₹6250",
    change: "+1.85%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100/80">
        <span className="text-[8px] font-extrabold text-[#EA580C]">NSE</span>
      </div>
    ),
  },
  {
    id: "hdbfin",
    name: "HDB FINANCIAL SERVICES...",
    ticker: "HDBFIN",
    price: "₹1180",
    change: "+3.42%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004C8F]">
        <span className="text-[8px] font-extrabold text-white">HDB</span>
      </div>
    ),
  },
  {
    id: "reliance",
    name: "RELIANCE RETAIL VENTURES...",
    ticker: "RELIANCE",
    price: "₹2890",
    change: "+1.14%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0F3D3E]">
        <span className="text-[8px] font-extrabold text-[#FBBF24]">RIL</span>
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
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004C8F]">
        <div className="flex size-4.5 items-center justify-center rounded-[3px] border border-[#ED232A] text-[7px] font-extrabold text-white">
          H
        </div>
      </div>
    ),
  },
  {
    id: "tcs",
    name: "TATA CONSULTANCY SERV...",
    ticker: "TCS",
    price: "₹4120",
    change: "-0.45%",
    isPositive: false,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#5850EC]/10">
        <span className="text-[8px] font-extrabold text-[#5850EC]">TCS</span>
      </div>
    ),
  },
  {
    id: "swiggy",
    name: "SWIGGY LIMITED",
    ticker: "SWIGGY",
    price: "₹460",
    change: "+1.92%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FC8019]">
        <span className="text-[10px] font-black text-white">S</span>
      </div>
    ),
  },
  {
    id: "nsdl",
    name: "NATIONAL SECURITIES DEP...",
    ticker: "NSDL",
    price: "₹1280",
    change: "+1.59%",
    isPositive: true,
    logo: (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E2A4A]">
        <span className="text-[7px] font-extrabold text-white">NSDL</span>
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
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E11D48]">
        <span className="text-[8px] font-black text-white">boAt</span>
      </div>
    ),
  },
];

export function RelatedStocksCard() {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
      {/* Heading */}
      <h3 className="text-base font-medium text-zinc-900">Related Stocks</h3>

      <div className="mt-4 divide-y divide-zinc-100">
        {relatedStocks.map((stock) => (
          <Link
            key={stock.id}
            href={`/stocks/${stock.id}`}
            className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:bg-zinc-50/70"
          >
            {/* Left: Logo + Name & Ticker */}
            <div className="flex min-w-0 items-center gap-3">
              {stock.logo}
              <div className="min-w-0">
                <p className="truncate text-xs font-normal text-zinc-900">
                  {stock.name}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400 uppercase">
                  {stock.ticker}
                </p>
              </div>
            </div>

            {/* Right: Price + Change Badge */}
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-xs font-normal text-zinc-900">
                {stock.price}
              </span>
              <span
                className={`mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${
                  stock.isPositive ? "bg-[#4D9A78]" : "bg-[#C8524B]"
                }`}
              >
                {stock.change}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
