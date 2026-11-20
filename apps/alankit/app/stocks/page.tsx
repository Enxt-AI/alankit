"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Columns3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type ViewMode = "card" | "col" | "details";

type StockDirectoryItem = {
  id: string;
  ticker: string;
  name: string;
  price: string;
  numericPrice: number;
  change: string;
  isPositive: boolean;
  volume: string;
  relVolume: string;
  marketCap: string;
  dividendYield: string;
  sector: string;
  logo: ReactNode;
};

const allStocks: StockDirectoryItem[] = [
  {
    id: "tatacap",
    ticker: "TATACAP",
    name: "TATA CAPITAL LIMITED",
    price: "₹950",
    numericPrice: 950,
    change: "+2.15%",
    isPositive: true,
    volume: "1.42M",
    relVolume: "1.18",
    marketCap: "₹3.38L Cr",
    dividendYield: "0.42%",
    sector: "Finance",
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
    numericPrice: 6250,
    change: "+1.85%",
    isPositive: true,
    volume: "840.5K",
    relVolume: "1.34",
    marketCap: "₹3.09L Cr",
    dividendYield: "1.28%",
    sector: "Finance",
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
    numericPrice: 1180,
    change: "+3.42%",
    isPositive: true,
    volume: "920.0K",
    relVolume: "1.12",
    marketCap: "₹93,450 Cr",
    dividendYield: "0.25%",
    sector: "Finance",
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
    numericPrice: 460,
    change: "+1.92%",
    isPositive: true,
    volume: "14.8M",
    relVolume: "1.35",
    marketCap: "₹1.03L Cr",
    dividendYield: "0.00%",
    sector: "Technology Services",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FC8019]">
        <span className="text-xs font-black text-white">S</span>
      </div>
    ),
  },
  {
    id: "reliance",
    ticker: "RELIANCE",
    name: "RELIANCE RETAIL VENTURES LTD",
    price: "₹2890",
    numericPrice: 2890,
    change: "+1.14%",
    isPositive: true,
    volume: "9.4M",
    relVolume: "0.94",
    marketCap: "₹19.55L Cr",
    dividendYield: "0.34%",
    sector: "Retail & Energy",
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
    ticker: "HDFCBANK",
    name: "HDFC BANK LIMITED",
    price: "₹1745",
    numericPrice: 1745,
    change: "+0.82%",
    isPositive: true,
    volume: "18.2M",
    relVolume: "1.04",
    marketCap: "₹13.28L Cr",
    dividendYield: "1.12%",
    sector: "Finance",
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
    ticker: "TCS",
    name: "TATA CONSULTANCY SERVICES LTD",
    price: "₹4120",
    numericPrice: 4120,
    change: "-0.45%",
    isPositive: false,
    volume: "3.1M",
    relVolume: "0.86",
    marketCap: "₹14.91L Cr",
    dividendYield: "1.34%",
    sector: "Technology Services",
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
    ticker: "INFY",
    name: "INFOSYS LIMITED",
    price: "₹1890",
    numericPrice: 1890,
    change: "+1.48%",
    isPositive: true,
    volume: "7.8M",
    relVolume: "1.09",
    marketCap: "₹7.84L Cr",
    dividendYield: "2.05%",
    sector: "Technology Services",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#007CC3]">
        <span className="text-[10px] font-bold tracking-tight text-white">
          Infy
        </span>
      </div>
    ),
  },
  {
    id: "icicibank",
    ticker: "ICICIBANK",
    name: "ICICI BANK LIMITED",
    price: "₹1285",
    numericPrice: 1285,
    change: "+0.95%",
    isPositive: true,
    volume: "15.4M",
    relVolume: "0.98",
    marketCap: "₹9.05L Cr",
    dividendYield: "0.78%",
    sector: "Finance",
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
    ticker: "BHARTIARTL",
    name: "BHARTI AIRTEL LIMITED",
    price: "₹1640",
    numericPrice: 1640,
    change: "+1.62%",
    isPositive: true,
    volume: "6.4M",
    relVolume: "1.02",
    marketCap: "₹9.34L Cr",
    dividendYield: "0.49%",
    sector: "Communications",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E40000]">
        <span className="text-[10px] font-extrabold text-white">airtel</span>
      </div>
    ),
  },
  {
    id: "sbin",
    ticker: "SBIN",
    name: "STATE BANK OF INDIA",
    price: "₹845",
    numericPrice: 845,
    change: "-0.64%",
    isPositive: false,
    volume: "19.5M",
    relVolume: "0.91",
    marketCap: "₹7.54L Cr",
    dividendYield: "1.62%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#280071]">
        <span className="text-[10px] font-extrabold text-[#00B5EF]">SBI</span>
      </div>
    ),
  },
  {
    id: "boat",
    ticker: "BOAT",
    name: "IMAGINE MARKETING LTD (BOAT)",
    price: "₹1450",
    numericPrice: 1450,
    change: "+2.84%",
    isPositive: true,
    volume: "410.0K",
    relVolume: "1.22",
    marketCap: "₹13,920 Cr",
    dividendYield: "0.00%",
    sector: "Consumer Durables",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E11D48]">
        <span className="text-[10px] font-black tracking-tight text-white">
          boAt
        </span>
      </div>
    ),
  },
  {
    id: "oyo",
    ticker: "OYO",
    name: "ORAVEL STAYS LIMITED (OYO)",
    price: "₹58",
    numericPrice: 58,
    change: "-1.69%",
    isPositive: false,
    volume: "3.4M",
    relVolume: "0.89",
    marketCap: "₹38,400 Cr",
    dividendYield: "0.00%",
    sector: "Consumer Services",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EE2E24]">
        <span className="text-[10px] font-black tracking-tight text-white">
          OYO
        </span>
      </div>
    ),
  },
  {
    id: "csk",
    ticker: "CSK",
    name: "CHENNAI SUPER KINGS CRICKET LTD",
    price: "₹215",
    numericPrice: 215,
    change: "+4.88%",
    isPositive: true,
    volume: "680.2K",
    relVolume: "1.45",
    marketCap: "₹6,625 Cr",
    dividendYield: "0.46%",
    sector: "Sports & Media",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FACC15]">
        <span className="text-[10px] font-black tracking-tight text-[#1E3A8A]">
          CSK
        </span>
      </div>
    ),
  },
  {
    id: "nsdl",
    ticker: "NSDL",
    name: "NATIONAL SECURITIES DEPOSITORY",
    price: "₹1280",
    numericPrice: 1280,
    change: "+1.59%",
    isPositive: true,
    volume: "520.4K",
    relVolume: "1.14",
    marketCap: "₹25,600 Cr",
    dividendYield: "0.78%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1E2A4A]">
        <span className="text-[9px] font-extrabold text-white">NSDL</span>
      </div>
    ),
  },
  {
    id: "vikramsolar",
    ticker: "VIKRAM",
    name: "VIKRAM SOLAR LIMITED",
    price: "₹395",
    numericPrice: 395,
    change: "+6.76%",
    isPositive: true,
    volume: "390.0K",
    relVolume: "1.52",
    marketCap: "₹11,240 Cr",
    dividendYield: "0.00%",
    sector: "Renewable Energy",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
        <span className="text-xs font-bold text-amber-600">V</span>
      </div>
    ),
  },
  {
    id: "waaree",
    ticker: "WAAREE",
    name: "WAAREE ENERGIES LIMITED",
    price: "₹2640",
    numericPrice: 2640,
    change: "+8.20%",
    isPositive: true,
    volume: "2.1M",
    relVolume: "1.68",
    marketCap: "₹69,800 Cr",
    dividendYield: "0.15%",
    sector: "Renewable Energy",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
        <span className="text-xs font-bold text-emerald-700">W</span>
      </div>
    ),
  },
  {
    id: "sbifunds",
    ticker: "SBIFUND",
    name: "SBI FUNDS MANAGEMENT LIMITED",
    price: "₹2150",
    numericPrice: 2150,
    change: "+0.94%",
    isPositive: true,
    volume: "210.5K",
    relVolume: "0.84",
    marketCap: "₹1.08L Cr",
    dividendYield: "1.15%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">S</span>
      </div>
    ),
  },
  {
    id: "herofin",
    ticker: "HEROFIN",
    name: "HERO FINCORP LIMITED",
    price: "₹1680",
    numericPrice: 1680,
    change: "-0.59%",
    isPositive: false,
    volume: "185.0K",
    relVolume: "0.72",
    marketCap: "₹21,380 Cr",
    dividendYield: "0.60%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">H</span>
      </div>
    ),
  },
  {
    id: "cial",
    ticker: "CIAL",
    name: "COCHIN INTERNATIONAL AIRPORT",
    price: "₹485",
    numericPrice: 485,
    change: "+1.25%",
    isPositive: true,
    volume: "310.2K",
    relVolume: "0.95",
    marketCap: "₹18,550 Cr",
    dividendYield: "2.88%",
    sector: "Infrastructure",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
        <span className="text-[10px] font-extrabold tracking-tighter text-[#0284C7]">
          CIAL
        </span>
      </div>
    ),
  },
  {
    id: "polymatech",
    ticker: "POLYMA",
    name: "POLYMATECH ELECTRONICS LTD",
    price: "₹920",
    numericPrice: 920,
    change: "+11.40%",
    isPositive: true,
    volume: "740.0K",
    relVolume: "1.74",
    marketCap: "₹7,450 Cr",
    dividendYield: "0.12%",
    sector: "Semiconductors",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">P</span>
      </div>
    ),
  },
  {
    id: "bira91",
    ticker: "BIRA91",
    name: "B9 BEVERAGES LIMITED (BIRA 91)",
    price: "₹540",
    numericPrice: 540,
    change: "-3.57%",
    isPositive: false,
    volume: "145.8K",
    relVolume: "0.64",
    marketCap: "₹4,320 Cr",
    dividendYield: "0.00%",
    sector: "Consumer Goods",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">B</span>
      </div>
    ),
  },
  {
    id: "carehealth",
    ticker: "CAREHLTH",
    name: "CARE HEALTH INSURANCE LIMITED",
    price: "₹340",
    numericPrice: 340,
    change: "+2.10%",
    isPositive: true,
    volume: "290.0K",
    relVolume: "0.92",
    marketCap: "₹31,600 Cr",
    dividendYield: "0.00%",
    sector: "Insurance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">C</span>
      </div>
    ),
  },
  {
    id: "hexaware",
    ticker: "HEXAWARE",
    name: "HEXAWARE TECHNOLOGIES LIMITED",
    price: "₹780",
    numericPrice: 780,
    change: "+1.69%",
    isPositive: true,
    volume: "620.0K",
    relVolume: "1.08",
    marketCap: "₹47,200 Cr",
    dividendYield: "1.10%",
    sector: "Technology Services",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">H</span>
      </div>
    ),
  },
  {
    id: "pharmeasy",
    ticker: "PHARMEASY",
    name: "API HOLDINGS LTD (PHARMEASY)",
    price: "₹12",
    numericPrice: 12,
    change: "-8.40%",
    isPositive: false,
    volume: "4.8M",
    relVolume: "1.32",
    marketCap: "₹7,200 Cr",
    dividendYield: "0.00%",
    sector: "Healthcare Tech",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">P</span>
      </div>
    ),
  },
  {
    id: "motilalhf",
    ticker: "MOHFL",
    name: "MOTILAL OSWAL HOME FINANCE LTD",
    price: "₹145",
    numericPrice: 145,
    change: "+0.69%",
    isPositive: true,
    volume: "510.0K",
    relVolume: "0.78",
    marketCap: "₹8,740 Cr",
    dividendYield: "0.35%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-medium text-[#5850EC]">M</span>
      </div>
    ),
  },
  {
    id: "bajfinance",
    ticker: "BAJFINANCE",
    name: "BAJAJ FINANCE LIMITED",
    price: "₹7120",
    numericPrice: 7120,
    change: "-0.88%",
    isPositive: false,
    volume: "1.9M",
    relVolume: "0.85",
    marketCap: "₹4.41L Cr",
    dividendYield: "0.51%",
    sector: "Finance",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0066B2]">
        <span className="text-[10px] font-extrabold text-white">BAJAJ</span>
      </div>
    ),
  },
  {
    id: "lt",
    ticker: "LT",
    name: "LARSEN & TOUBRO LIMITED",
    price: "₹3580",
    numericPrice: 3580,
    change: "+1.32%",
    isPositive: true,
    volume: "2.4M",
    relVolume: "0.96",
    marketCap: "₹4.92L Cr",
    dividendYield: "0.78%",
    sector: "Engineering & Infra",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-bold text-[#5850EC]">L&amp;T</span>
      </div>
    ),
  },
  {
    id: "itc",
    ticker: "ITC",
    name: "ITC LIMITED",
    price: "₹495",
    numericPrice: 495,
    change: "+0.51%",
    isPositive: true,
    volume: "11.6M",
    relVolume: "0.89",
    marketCap: "₹6.19L Cr",
    dividendYield: "2.78%",
    sector: "FMCG & Hotels",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-xs font-bold text-[#5850EC]">ITC</span>
      </div>
    ),
  },
  {
    id: "paytm",
    ticker: "PAYTM",
    name: "ONE 97 COMMUNICATIONS (PAYTM)",
    price: "₹740",
    numericPrice: 740,
    change: "-2.12%",
    isPositive: false,
    volume: "8.3M",
    relVolume: "1.15",
    marketCap: "₹47,100 Cr",
    dividendYield: "0.00%",
    sector: "Fintech",
    logo: (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00BAF2]/15">
        <span className="text-[9px] font-extrabold text-[#002E6E]">Paytm</span>
      </div>
    ),
  },
];

const MAX_STOCK_PRICE = 7500;

const sectorOptions = [
  "All Sectors",
  "Finance",
  "Technology Services",
  "Renewable Energy",
  "Consumer Durables",
  "Retail & Energy",
  "Communications",
  "Infrastructure",
];

type TrendFilter = "all" | "gainers" | "losers";

export default function StocksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<number>(MAX_STOCK_PRICE);
  const [selectedSector, setSelectedSector] = useState<string>("All Sectors");
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");

  const filteredStocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStocks.filter((stock) => {
      const matchesSearch =
        !q ||
        stock.ticker.toLowerCase().includes(q) ||
        stock.name.toLowerCase().includes(q) ||
        stock.sector.toLowerCase().includes(q);
      const matchesPrice = stock.numericPrice <= maxPrice;
      const matchesSector =
        selectedSector === "All Sectors" || stock.sector === selectedSector;
      const matchesTrend =
        trendFilter === "all" ||
        (trendFilter === "gainers" && stock.isPositive) ||
        (trendFilter === "losers" && !stock.isPositive);

      return matchesSearch && matchesPrice && matchesSector && matchesTrend;
    });
  }, [searchQuery, maxPrice, selectedSector, trendFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setMaxPrice(MAX_STOCK_PRICE);
    setSelectedSector("All Sectors");
    setTrendFilter("all");
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    maxPrice < MAX_STOCK_PRICE ||
    selectedSector !== "All Sectors" ||
    trendFilter !== "all";

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />

      <main className="flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          {/* Top Header Row: Title on Left + ONLY View Icons on Right */}
          <ScrollReveal variant="fade-up">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 pb-6">
              <div>
                <h1 className="text-3xl font-normal tracking-tight text-zinc-900 sm:text-[38px]">
                  Unlisted Stocks in India
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-zinc-500">
                  Showing {filteredStocks.length} of {allStocks.length} Indian
                  stocks
                </p>
              </div>

              {/* Right: Compact View Mode Switcher ("View: [List] [Grid] [Col]") */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-medium text-zinc-500 mr-1">
                  View:
                </span>

                {/* List / Details View Button */}
                <button
                  type="button"
                  onClick={() => setViewMode("details")}
                  aria-label="Details List View"
                  title="Details List View"
                  className={`flex size-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    viewMode === "details"
                      ? "border-[#2563EB] bg-[#2563EB] text-white shadow-2xs"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle
                      cx="4.5"
                      cy="6"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />
                    <line x1="9" y1="6" x2="20" y2="6" />
                    <circle
                      cx="4.5"
                      cy="12"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />
                    <line x1="9" y1="12" x2="20" y2="12" />
                    <circle
                      cx="4.5"
                      cy="18"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />
                    <line x1="9" y1="18" x2="20" y2="18" />
                  </svg>
                </button>

                {/* Card / Grid View Button */}
                <button
                  type="button"
                  onClick={() => setViewMode("card")}
                  aria-label="Card Grid View"
                  title="Card Grid View"
                  className={`flex size-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    viewMode === "card"
                      ? "border-[#2563EB] bg-[#2563EB] text-white shadow-2xs"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                </button>

                {/* Column View Button */}
                <button
                  type="button"
                  onClick={() => setViewMode("col")}
                  aria-label="Column View"
                  title="Column View"
                  className={`flex size-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    viewMode === "col"
                      ? "border-[#2563EB] bg-[#2563EB] text-white shadow-2xs"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Columns3 className="size-[15px]" />
                </button>
              </div>
            </div>
          </ScrollReveal>

          {/* Main 2-Column Layout: Left Sidebar Filters + Right Stocks Content */}
          <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* LEFT SIDEBAR: Search Bar + Price Seek Bar + Market Movement + Sector Filters */}
            <aside className="lg:col-span-3 lg:sticky lg:top-6">
              <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-6">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    <SlidersHorizontal className="size-4 text-[#2563EB]" />
                    <span>Filters</span>
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* 1. Search Input */}
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-2">
                    Search Stock
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Symbol or company..."
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#2563EB] focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Price Seek Bar */}
                <div className="border-t border-zinc-100 pt-5">
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="font-medium text-zinc-700">
                      Price Range
                    </span>
                    <span className="font-semibold text-[#2563EB] tabular-nums">
                      Up to ₹{maxPrice.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={10}
                    max={MAX_STOCK_PRICE}
                    step={10}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    aria-label="Maximum stock price filter"
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-[#2563EB]"
                  />

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>₹10</span>
                    <span>₹3,500</span>
                    <span>₹{MAX_STOCK_PRICE.toLocaleString("en-IN")}</span>
                  </div>

                  {/* Quick Price Presets */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                      { label: "Under ₹500", value: 500 },
                      { label: "Under ₹1,500", value: 1500 },
                      { label: "Under ₹3,000", value: 3000 },
                      { label: "All", value: MAX_STOCK_PRICE },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setMaxPrice(preset.value)}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          maxPrice === preset.value
                            ? "bg-blue-50 text-[#2563EB] ring-1 ring-[#2563EB]/30"
                            : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Market Performance Filter */}
                <div className="border-t border-zinc-100 pt-5">
                  <p className="text-xs font-medium text-zinc-700 mb-2.5">
                    Market Trend
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "all", label: "All" },
                      { id: "gainers", label: "Gainers" },
                      { id: "losers", label: "Losers" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTrendFilter(item.id as TrendFilter)}
                        className={`rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          trendFilter === item.id
                            ? "bg-[#2563EB] text-white"
                            : "border border-zinc-200/80 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Sector Filter List */}
                <div className="border-t border-zinc-100 pt-5">
                  <p className="text-xs font-medium text-zinc-700 mb-2.5">
                    Sector
                  </p>
                  <div className="space-y-1">
                    {sectorOptions.map((sector) => {
                      const active = selectedSector === sector;
                      return (
                        <button
                          key={sector}
                          type="button"
                          onClick={() => setSelectedSector(sector)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                            active
                              ? "bg-blue-50/80 font-medium text-[#2563EB]"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}
                        >
                          <span>{sector}</span>
                          {active && (
                            <span className="size-1.5 rounded-full bg-[#2563EB]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            {/* RIGHT MAIN CONTENT: Stocks in Card / Col / Details View */}
            <div className="lg:col-span-9">
              {filteredStocks.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-12 text-center">
                  <p className="text-base font-medium text-zinc-900">
                    No stocks match your current filters
                  </p>
                  <p className="mt-1.5 text-xs sm:text-sm text-zinc-500">
                    Try adjusting your search keyword, sector, or increasing the
                    price range in the sidebar.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-5 text-xs sm:text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* VIEW 1: CARD VIEW (3-Column Boxed Cards next to Sidebar) */}
                  {viewMode === "card" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredStocks.map((stock) => (
                        <Link
                          key={stock.id}
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
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white ${
                                stock.isPositive
                                  ? "bg-[#4D9A78]"
                                  : "bg-[#C8524B]"
                              }`}
                            >
                              {stock.change}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* VIEW 2: COL VIEW (2-Column Compact Row Layout next to Sidebar) */}
                  {viewMode === "col" && (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                      {filteredStocks.map((stock) => (
                        <Link
                          key={stock.id}
                          href={`/stocks/${stock.id}`}
                          className="flex items-center justify-between gap-4 border-b border-zinc-100 py-4 transition-colors hover:bg-zinc-50/80 px-2 rounded-lg"
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
                                stock.isPositive
                                  ? "bg-[#4D9A78]"
                                  : "bg-[#C8524B]"
                              }`}
                            >
                              {stock.change}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* VIEW 3: DETAILS / LIST VIEW (Full Financial Table) */}
                  {viewMode === "details" && (
                    <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] border-collapse text-left">
                          <thead>
                            <tr className="border-b border-zinc-100 text-xs font-normal text-zinc-500">
                              <th className="py-3.5 pl-5 pr-4 font-normal">
                                Symbol
                              </th>
                              <th className="px-4 py-3.5 font-normal">Price</th>
                              <th className="px-4 py-3.5 font-normal">
                                Change %
                              </th>
                              <th className="px-4 py-3.5 font-normal">
                                Volume
                              </th>
                              <th className="px-4 py-3.5 font-normal">
                                Rel Volume
                              </th>
                              <th className="px-4 py-3.5 font-normal">
                                Market Cap
                              </th>
                              <th className="px-4 py-3.5 font-normal">
                                Dividend %
                              </th>
                              <th className="py-3.5 pl-4 pr-5 font-normal">
                                Sector
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-sm">
                            {filteredStocks.map((row) => (
                              <tr
                                key={row.id}
                                className="transition-colors hover:bg-zinc-50/70"
                              >
                                {/* Symbol Column */}
                                <td className="py-4 pl-5 pr-4">
                                  <Link
                                    href={`/stocks/${row.id}`}
                                    className="flex items-center gap-3 group"
                                  >
                                    <div className="scale-75 origin-left -mr-2">
                                      {row.logo}
                                    </div>
                                    <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 group-hover:bg-blue-50 group-hover:text-[#2563EB] transition-colors">
                                      {row.ticker}
                                    </span>
                                    <span className="max-w-[180px] truncate text-xs sm:text-[13px] font-normal text-zinc-900 uppercase group-hover:text-[#2563EB] transition-colors">
                                      {row.name}
                                    </span>
                                  </Link>
                                </td>

                                {/* Price */}
                                <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                                  {row.price}
                                </td>

                                {/* Change % */}
                                <td className="px-4 py-4">
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${
                                      row.isPositive
                                        ? "bg-[#4D9A78]"
                                        : "bg-[#C8524B]"
                                    }`}
                                  >
                                    {row.change}
                                  </span>
                                </td>

                                {/* Volume */}
                                <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                                  {row.volume}
                                </td>

                                {/* Rel Volume */}
                                <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                                  {row.relVolume}
                                </td>

                                {/* Market Cap */}
                                <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                                  {row.marketCap}
                                </td>

                                {/* Dividend % */}
                                <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                                  {row.dividendYield}
                                </td>

                                {/* Sector */}
                                <td className="py-4 pl-4 pr-5 text-xs sm:text-[13px] text-zinc-800">
                                  {row.sector}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
