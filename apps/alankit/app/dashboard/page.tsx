"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  BarChart2,
  Bookmark,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  Bell,
  Search,
  Share2,
  Star,
  ChevronRight,
  ArrowUpRight,
  BookmarkCheck,
  Check,
  X,
  Download,
} from "lucide-react";
import { stocksCatalog } from "@/lib/stocks-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type DashboardStock = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  marketType: "Unlisted" | "Listed";
  price: string;
  numericPrice: number;
  changePct: string;
  isPositive: boolean;
  overnightPrice: string;
  overnightChange: string;
  marketCap: string;
  volume24h: string;
  volumeChange: string;
  peRatio: string;
  high52w: string;
  low52w: string;
  riskLevel: "Low Risk" | "Medium Risk";
  riskPositionPct: number;
  position: {
    totalShares: number;
    avgBuyPrice: string;
    totalInvested: string;
    currentValue: string;
    profitLoss: string;
    profitPct: string;
  };
  chartPoints: number[];
  sparkline: string;
  logoBg: string;
  logoText: string;
  logoColor?: string;
};

const dashboardStocks: DashboardStock[] = [
  {
    id: "tatacap",
    ticker: "TATACAP",
    name: "Tata Capital",
    sector: "Financial Services",
    marketType: "Unlisted",
    price: "₹950.45",
    numericPrice: 950.45,
    changePct: "14%",
    isPositive: true,
    overnightPrice: "₹964.85",
    overnightChange: "₹14.40",
    marketCap: "₹3.38L Cr",
    volume24h: "₹66.6Cr",
    volumeChange: "14%",
    peRatio: "28.5",
    high52w: "₹1,098.23",
    low52w: "₹724.17",
    riskLevel: "Low Risk",
    riskPositionPct: 24,
    position: {
      totalShares: 200,
      avgBuyPrice: "₹820.00",
      totalInvested: "₹1,64,000",
      currentValue: "₹1,90,090",
      profitLoss: "+₹26,090",
      profitPct: "15.9%",
    },
    chartPoints: [
      176, 176, 184, 184, 196, 196, 186, 186, 200, 200, 215, 222, 195, 195,
      170, 196, 178, 210, 210, 222, 212, 212, 238, 238, 226, 215, 228, 228,
      244, 244, 255, 258,
    ],
    sparkline:
      "M0 26 L14 22 L28 24 L42 17 L56 19 L70 13 L84 16 L98 9 L112 11 L132 4",
    logoBg: "#EFF6FF",
    logoText: "T",
    logoColor: "#2563EB",
  },
  {
    id: "nse",
    ticker: "NSE",
    name: "NSE India",
    sector: "Capital Markets",
    marketType: "Unlisted",
    price: "₹6,250.00",
    numericPrice: 6250,
    changePct: "18.4%",
    isPositive: true,
    overnightPrice: "₹6,310.50",
    overnightChange: "₹60.50",
    marketCap: "₹3.09L Cr",
    volume24h: "₹142.8Cr",
    volumeChange: "9.2%",
    peRatio: "37.2",
    high52w: "₹6,480.00",
    low52w: "₹4,120.00",
    riskLevel: "Low Risk",
    riskPositionPct: 18,
    position: {
      totalShares: 50,
      avgBuyPrice: "₹5,400.00",
      totalInvested: "₹2,70,000",
      currentValue: "₹3,12,500",
      profitLoss: "+₹42,500",
      profitPct: "15.7%",
    },
    chartPoints: [
      165, 170, 175, 172, 182, 188, 185, 194, 198, 204, 210, 208, 216, 220,
      214, 222, 228, 225, 232, 236, 230, 238, 242, 240, 246, 250, 248, 252,
      255, 256, 257, 258,
    ],
    sparkline:
      "M0 28 L12 22 L24 25 L36 16 L48 20 L60 12 L72 18 L84 10 L96 14 L108 6 L120 12 L132 4",
    logoBg: "#FFF7ED",
    logoText: "N",
    logoColor: "#EA580C",
  },
  {
    id: "hdbfin",
    ticker: "HDBFIN",
    name: "HDB Financial",
    sector: "Financial Services",
    marketType: "Unlisted",
    price: "₹1,180.20",
    numericPrice: 1180.2,
    changePct: "11.2%",
    isPositive: true,
    overnightPrice: "₹1,195.00",
    overnightChange: "₹14.80",
    marketCap: "₹93,450 Cr",
    volume24h: "₹48.2Cr",
    volumeChange: "6.4%",
    peRatio: "34.8",
    high52w: "₹1,260.00",
    low52w: "₹890.00",
    riskLevel: "Low Risk",
    riskPositionPct: 28,
    position: {
      totalShares: 150,
      avgBuyPrice: "₹1,040.00",
      totalInvested: "₹1,56,000",
      currentValue: "₹1,77,030",
      profitLoss: "+₹21,030",
      profitPct: "13.5%",
    },
    chartPoints: [
      180, 178, 185, 190, 188, 195, 202, 198, 205, 212, 208, 215, 210, 204,
      212, 218, 224, 220, 228, 234, 230, 236, 240, 238, 244, 248, 245, 250,
      252, 254, 256, 258,
    ],
    sparkline:
      "M0 25 L16 21 L32 23 L48 16 L64 18 L80 12 L96 14 L112 8 L132 5",
    logoBg: "#EFF6FF",
    logoText: "H",
    logoColor: "#1D4ED8",
  },
  {
    id: "swiggy",
    ticker: "SWIGGY",
    name: "Swiggy",
    sector: "Consumer Tech",
    marketType: "Listed",
    price: "₹460.80",
    numericPrice: 460.8,
    changePct: "9.4%",
    isPositive: true,
    overnightPrice: "₹468.10",
    overnightChange: "₹7.30",
    marketCap: "₹1.03L Cr",
    volume24h: "₹94.5Cr",
    volumeChange: "11%",
    peRatio: "44.2",
    high52w: "₹518.00",
    low52w: "₹345.00",
    riskLevel: "Medium Risk",
    riskPositionPct: 44,
    position: {
      totalShares: 300,
      avgBuyPrice: "₹390.00",
      totalInvested: "₹1,17,000",
      currentValue: "₹1,38,240",
      profitLoss: "+₹21,240",
      profitPct: "18.1%",
    },
    chartPoints: [
      168, 174, 170, 180, 186, 178, 190, 196, 205, 198, 188, 196, 208, 214,
      206, 218, 224, 216, 228, 235, 229, 238, 242, 236, 244, 249, 246, 251,
      253, 255, 256, 258,
    ],
    sparkline:
      "M0 24 L15 18 L30 22 L45 14 L60 19 L75 9 L90 16 L105 12 L120 15 L132 6",
    logoBg: "#FFF7ED",
    logoText: "S",
    logoColor: "#F97316",
  },
];

type RecommendationCard = {
  id: string;
  name: string;
  sector: string;
  price: string;
  change: string;
  isPositive: boolean;
  sparkline: string;
  logo: React.ReactNode;
};

const youMayAlsoLike: RecommendationCard[] = [
  {
    id: "nse",
    name: "NSE India",
    sector: "Capital Markets",
    price: "₹6,250.0",
    change: "1.85%",
    isPositive: true,
    sparkline:
      "M0 28 L12 22 L24 25 L36 16 L48 20 L60 12 L72 18 L84 10 L96 14 L108 6 L120 12 L132 4",
    logo: (
      <div className="flex size-7 items-center justify-center rounded-full bg-orange-50 text-[10px] font-bold text-orange-600">
        N
      </div>
    ),
  },
  {
    id: "tcs",
    name: "TCS Ltd",
    sector: "Technology",
    price: "₹4,120.0",
    change: "0.84%",
    isPositive: false,
    sparkline:
      "M0 8 L14 6 L28 18 L42 14 L56 24 L70 16 L84 22 L98 20 L112 26 L126 19 L132 24",
    logo: (
      <div className="flex size-7 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
        T
      </div>
    ),
  },
  {
    id: "hdbfin",
    name: "HDB Fin",
    sector: "Finance",
    price: "₹1,180.2",
    change: "0.27%",
    isPositive: false,
    sparkline:
      "M0 6 L16 14 L32 10 L48 20 L64 18 L80 25 L96 21 L112 27 L132 24",
    logo: (
      <div className="flex size-7 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
        H
      </div>
    ),
  },
  {
    id: "swiggy",
    name: "Swiggy",
    sector: "Consumer",
    price: "₹460.80",
    change: "1.24%",
    isPositive: true,
    sparkline:
      "M0 24 L15 18 L30 22 L45 14 L60 19 L75 9 L90 16 L105 12 L120 15 L132 6",
    logo: (
      <div className="flex size-7 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-600">
        S
      </div>
    ),
  },
];

const recentTransactions = [
  {
    id: "TXN-98412",
    stockId: "tatacap",
    stockName: "Tata Capital",
    type: "BUY",
    shares: 50,
    price: "₹945.00",
    amount: "₹47,250",
    date: "02 Nov 2026",
    status: "Credited to Demat",
  },
  {
    id: "TXN-98104",
    stockId: "nse",
    stockName: "NSE India",
    type: "BUY",
    shares: 20,
    price: "₹6,100.00",
    amount: "₹1,22,000",
    date: "24 Oct 2026",
    status: "Credited to Demat",
  },
  {
    id: "TXN-97689",
    stockId: "hdbfin",
    stockName: "HDB Financial",
    type: "BUY",
    shares: 150,
    price: "₹1,040.00",
    amount: "₹1,56,000",
    date: "11 Oct 2026",
    status: "Credited to Demat",
  },
];

const mainMenuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "portfolio", label: "Portfolio", icon: BarChart2 },
  { id: "watchlist", label: "Watchlist", icon: Bookmark },
  { id: "orders", label: "Orders", icon: ClipboardList },
] as const;

const timeframes = ["1D", "1M", "1Y", "3Y", "5Y", "ALL"] as const;
const portfolioSeriesByPeriod = {
  "1M": [790000, 786000, 801000, 795000, 812000, 817860],
  "3M": [742000, 751000, 739000, 767000, 773000, 790000, 785000, 817860],
  "6M": [698000, 710000, 725000, 718000, 742000, 751000, 770000, 762000, 790000, 817860],
  "1Y": [645000, 660000, 658000, 689000, 675000, 706000, 720000, 710000, 744000, 760000, 789000, 817860],
  ALL: [520000, 548000, 570000, 605000, 632000, 645000, 660000, 658000, 689000, 675000, 706000, 720000, 710000, 744000, 760000, 789000, 817860],
} as const;
const portfolioPeriods = Object.keys(portfolioSeriesByPeriod) as (keyof typeof portfolioSeriesByPeriod)[];
const WATCHLIST_STORAGE_KEY = "alankit-watchlist";

function DashboardPortfolio() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Portfolio</h1>
          <p className="mt-1 text-xs text-zinc-500">A summary of your holdings and current positions.</p>
        </div>
        <Link href="/stocks" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E2433] px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          <span>Explore Stocks</span><ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4"><p className="text-xs font-medium text-zinc-400">Portfolio value</p><p className="mt-2 text-xl font-bold text-zinc-900">₹8,17,860</p><p className="mt-1 text-[11px] text-zinc-400">Across {dashboardStocks.length} active holdings</p></div>
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4"><p className="text-xs font-medium text-zinc-400">Total invested</p><p className="mt-2 text-xl font-bold text-zinc-900">₹7,07,000</p><p className="mt-1 text-[11px] text-zinc-400">Cost basis of your positions</p></div>
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4"><p className="text-xs font-medium text-zinc-400">Total profit / loss</p><p className="mt-2 text-xl font-bold text-emerald-600">+₹1,10,860</p><p className="mt-1 text-[11px] text-emerald-600">▲ 15.68% overall</p></div>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Your holdings</h2>
          <p className="mt-1 text-xs text-zinc-400">{dashboardStocks.length} active positions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Shares</th><th className="px-5 py-3">Avg. buy price</th><th className="px-5 py-3">Invested</th><th className="px-5 py-3">Current value</th><th className="px-5 py-3">Profit / Loss</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {dashboardStocks.map((stock) => (
                <tr key={stock.id} className="text-zinc-600 transition-colors hover:bg-zinc-50">
                  <td className="px-5 py-4"><Link href={`/stocks/${stock.id}`} className="flex items-center gap-3 hover:text-[#2563EB]"><span className="flex size-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ backgroundColor: stock.logoBg, color: stock.logoColor ?? "#2563EB" }}>{stock.logoText}</span><span><span className="block font-semibold text-zinc-900">{stock.ticker}</span><span className="block text-[11px] text-zinc-400">{stock.name}</span></span></Link></td>
                  <td className="px-5 py-4">{stock.position.totalShares}</td><td className="px-5 py-4">{stock.position.avgBuyPrice}</td><td className="px-5 py-4">{stock.position.totalInvested}</td><td className="px-5 py-4 font-semibold text-zinc-900">{stock.position.currentValue}</td><td className={`px-5 py-4 font-semibold ${stock.isPositive ? "text-emerald-600" : "text-rose-600"}`}>{stock.position.profitLoss} <span className="text-[10px]">({stock.position.profitPct})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DashboardOrders() {
  const [selectedOrder, setSelectedOrder] = useState<(typeof recentTransactions)[number] | null>(null);

  function downloadDealSheet(order: (typeof recentTransactions)[number]) {
    const rows = [
      ["Deal Sheet", order.id],
      ["Stock", order.stockName],
      ["Order Type", order.type],
      ["Quantity", String(order.shares)],
      ["Price per Share", order.price],
      ["Total Amount", order.amount],
      ["Order Date", order.date],
      ["Status", order.status],
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `deal-sheet-${order.id.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  function downloadOrderDocument(
    order: (typeof recentTransactions)[number],
    documentType: "Receipt" | "Invoice",
  ) {
    const plain = (value: string) =>
      value
        .replace(/₹/g, "INR ")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
    const lines = [
      "ALANKIT",
      documentType === "Receipt" ? "Order Payment Receipt" : "Order Invoice",
      "",
      `Document Number: ${documentType === "Receipt" ? `RCT-${order.id}` : `INV-${order.id}`}`,
      `Order Number: ${order.id}`,
      `Order Date: ${order.date}`,
      "",
      "ORDER DETAILS",
      `Stock: ${order.stockName}`,
      `Order Type: ${order.type}`,
      `Quantity: ${order.shares} shares`,
      `Price per Share: ${order.price}`,
      `Total Amount: ${order.amount}`,
      `Status: ${order.status}`,
      "",
      documentType === "Receipt"
        ? "This document confirms the payment recorded for this order."
        : "This document summarizes the purchase recorded for this order.",
    ];
    const content = lines
      .map((line, index) => {
        const fontSize = index === 0 ? 22 : index === 1 ? 16 : index === 7 ? 12 : 11;
        const y = 790 - index * 32;
        return `BT /F1 ${fontSize} Tf 54 ${y} Td (${plain(line)}) Tj ET`;
      })
      .join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `${documentType.toLowerCase()}-${order.id.toLowerCase()}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Orders</h1>
          <p className="mt-1 text-xs text-zinc-500">Review your recent stock orders and their status.</p>
        </div>
        <Link href="/stocks" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E2433] px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          <span>Explore Stocks</span><ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recent orders</h2>
          <p className="mt-1 text-xs text-zinc-400">{recentTransactions.length} orders</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-5 py-3">Order</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Deal Sheet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {recentTransactions.map((order) => (
                <tr
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View order journey for ${order.id}`}
                  onClick={() => setSelectedOrder(order)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOrder(order);
                    }
                  }}
                  className="cursor-pointer text-zinc-600 transition-colors hover:bg-blue-50/50 focus:bg-blue-50/50 focus:outline-none"
                >
                  <td className="px-5 py-4 font-medium text-zinc-500">{order.id}</td>
                  <td className="px-5 py-4"><Link href={`/stocks/${order.stockId}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-zinc-900 hover:text-[#2563EB]">{order.stockName}</Link></td>
                  <td className="px-5 py-4"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{order.type}</span></td>
                  <td className="px-5 py-4">{order.shares}</td><td className="px-5 py-4">{order.price}</td><td className="px-5 py-4 font-semibold text-zinc-900">{order.amount}</td><td className="px-5 py-4">{order.date}</td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />{order.status}</span></td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadDealSheet(order);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-[#2563EB]"
                    >
                      <Download className="size-3.5" />Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => setSelectedOrder(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-journey-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-xs font-medium text-zinc-400">Order journey</p>
                <h2 id="order-journey-title" className="mt-1 text-lg font-semibold text-zinc-900">{selectedOrder.stockName}</h2>
                <p className="mt-1 text-xs text-zinc-500">Order {selectedOrder.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order journey" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#F8FAFC] p-4 text-xs">
                <div><p className="text-zinc-400">Type</p><p className="mt-1 font-semibold text-emerald-700">{selectedOrder.type}</p></div>
                <div><p className="text-zinc-400">Quantity</p><p className="mt-1 font-semibold text-zinc-900">{selectedOrder.shares} shares</p></div>
                <div><p className="text-zinc-400">Total</p><p className="mt-1 font-semibold text-zinc-900">{selectedOrder.amount}</p></div>
              </div>

              <ol className="mt-6">
                {[
                  { title: "Order placed", detail: `Your ${selectedOrder.type.toLowerCase()} order was received.`, date: selectedOrder.date },
                  { title: "Payment confirmed", detail: "Payment was confirmed for this order.", date: "Completed" },
                  { title: "Shares processed", detail: "The shares were processed for transfer.", date: "Completed" },
                  { title: "Credited to your Demat", detail: "Shares were credited to your Demat account.", date: "Current status" },
                ].map((step, index, steps) => (
                  <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-8px)] w-px bg-emerald-200" aria-hidden="true" />}
                    <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-4" /></span>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
                      <div><p className="text-sm font-semibold text-zinc-900">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-zinc-500">{step.detail}</p></div>
                      <span className="shrink-0 text-[11px] text-zinc-400">{step.date}</span>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => downloadOrderDocument(selectedOrder, "Receipt")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <Download className="size-4" />Download receipt
                </button>
                <button
                  type="button"
                  onClick={() => downloadOrderDocument(selectedOrder, "Invoice")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                >
                  <Download className="size-4" />Download invoice
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DashboardWatchlist() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
    setIsLoaded(true);
  }, []);

  function removeStock(id: string) {
    setSavedIds((current) => {
      const next = current.filter((savedId) => savedId !== id);
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const watchedStocks = stocksCatalog.filter((stock) => savedIds.includes(stock.id));

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">My Watchlist</h1>
          <p className="mt-1 text-xs text-zinc-500">Follow the stocks you want to keep an eye on.</p>
        </div>
        <Link href="/stocks" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E2433] px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          <span>Explore Stocks</span><ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Saved stocks</h2>
            <p className="mt-1 text-xs text-zinc-400">{watchedStocks.length} {watchedStocks.length === 1 ? "stock" : "stocks"}</p>
          </div>
          <Bookmark className="size-4 text-[#2563EB]" />
        </div>
        {!isLoaded ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">Loading your watchlist…</p>
        ) : watchedStocks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bookmark className="mx-auto size-6 text-zinc-300" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900">Your watchlist is empty</h3>
            <p className="mt-1 text-xs text-zinc-500">Explore stocks and add the ones you want to follow.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {watchedStocks.map((stock) => (
              <div key={stock.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <Link href={`/stocks/${stock.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: stock.logoBg }}>{stock.logoText ?? stock.ticker.slice(0, 3)}</span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-900">{stock.ticker}</span><span className="block truncate text-xs text-zinc-500">{stock.name}</span></span>
                </Link>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="text-sm font-semibold text-zinc-900">₹{stock.price.toLocaleString("en-IN")}</p><p className={`text-xs font-medium ${stock.isPositive ? "text-emerald-600" : "text-rose-600"}`}>{stock.changePercent}</p></div>
                  <button type="button" onClick={() => removeStock(stock.id)} aria-label={`Remove ${stock.ticker} from watchlist`} className="rounded-lg border border-zinc-200 p-2 text-[#2563EB] hover:bg-blue-50"><BookmarkCheck className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  // Default is null -> shows Holdings & Portfolio Overview first!
  // Clicking any stock from holdings opens its Detailed View.
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"Price" | "Market Cap">(
    "Price"
  );
  const [activeTimeframe, setActiveTimeframe] = useState<string>("1Y");
  const [portfolioPeriod, setPortfolioPeriod] = useState<keyof typeof portfolioSeriesByPeriod>("1Y");
  const [recPeriod, setRecPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [isStarred, setIsStarred] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number>(19);
  const [searchText, setSearchText] = useState("");

  const activeStock =
    dashboardStocks.find((s) => s.id === selectedStockId) || null;

  const filteredHoldings = dashboardStocks.filter(
    (s) =>
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.ticker.toLowerCase().includes(searchText.toLowerCase()) ||
      s.sector.toLowerCase().includes(searchText.toLowerCase())
  );

  // Build SVG path for the step/area chart when a stock is selected
  const pts = activeStock ? activeStock.chartPoints : dashboardStocks[0].chartPoints;
  const minVal = 120;
  const maxVal = 265;
  const chartW = 680;
  const chartH = 250;

  const coords = pts.map((val, idx) => {
    const x = (idx / (pts.length - 1)) * chartW;
    const y =
      chartH - ((val - minVal) / (maxVal - minVal)) * (chartH - 24) - 12;
    return { x, y, val };
  });

  const linePath = coords
    .map(
      (pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
    )
    .join(" ");
  const areaPath = `${linePath} L${chartW},${chartH} L0,${chartH} Z`;

  const activePoint = coords[hoverIdx] || coords[19];
  const displayHoverPrice = activeStock
    ? (activeStock.numericPrice * (activePoint.val / 212.18)).toFixed(2)
    : "0.00";

  const portfolioValues = portfolioSeriesByPeriod[portfolioPeriod];
  const portfolioChartWidth = 1000;
  const portfolioChartHeight = 220;
  const portfolioMin = Math.min(...portfolioValues) - 12000;
  const portfolioMax = Math.max(...portfolioValues) + 12000;
  const portfolioPoints = portfolioValues.map((value, index) => ({
    x: (index / (portfolioValues.length - 1)) * portfolioChartWidth,
    y: portfolioChartHeight - ((value - portfolioMin) / (portfolioMax - portfolioMin)) * portfolioChartHeight,
  }));
  const portfolioLinePath = portfolioPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const portfolioAreaPath = `${portfolioLinePath} L${portfolioChartWidth},${portfolioChartHeight} L0,${portfolioChartHeight} Z`;

  return (
    <div className="h-screen w-full overflow-hidden bg-white font-sans text-zinc-900">
      {/* Full-width Main App Shell Container */}
      <div className="flex h-screen w-full overflow-hidden bg-white">
        {/* ================= FIXED LEFT SIDEBAR ================= */}
        <aside
          className={`sticky top-0 flex h-screen flex-col justify-between border-r border-zinc-100 bg-white transition-all duration-200 shrink-0 select-none ${
            sidebarCollapsed ? "w-[76px]" : "w-60 xl:w-64"
          }`}
        >
          <div className="p-4">
            {/* Top Brand Row */}
            <div className="flex items-center justify-between px-1 py-1">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-zinc-200 text-[#2563EB]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 400 400"
                    fill="none"
                    aria-hidden="true"
                  >
                    <g
                      stroke="currentColor"
                      strokeWidth="42"
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
                {!sidebarCollapsed && (
                  <span className="text-[15px] font-semibold tracking-tight text-zinc-800">
                    Alankit
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((p) => !p)}
                aria-label="Toggle sidebar"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </button>
            </div>

            {/* MAIN Navigation Group */}
            <div className="mt-6">
              {!sidebarCollapsed && (
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  MAIN
                </p>
              )}
              <nav className="mt-2 space-y-1">
                {mainMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id);
                        setSelectedStockId(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? "bg-[#F1F5F9] text-zinc-900 font-semibold"
                          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    >
                      <Icon
                        className={`size-4 shrink-0 ${
                          active ? "text-zinc-900" : "text-zinc-400"
                        }`}
                      />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom User Profile Pill -> Links to Separate Profile Page (/profile) */}
          <div className="border-t border-zinc-100 p-4">
            <Link
              href="/profile"
              className="flex items-center justify-between gap-2.5 rounded-xl p-1.5 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E2433] text-xs font-semibold text-white">
                  JD
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900">
                      John Doe
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">
                      investor@example.com
                    </p>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <ChevronRight className="size-4 shrink-0 text-zinc-400" />
              )}
            </Link>
          </div>
        </aside>

        {/* ================= MAIN WORKSPACE AREA (Scrollable) ================= */}
        <div className="flex h-screen flex-1 flex-col min-w-0 overflow-y-auto">
          {/* Top Bar: Breadcrumb on Left + Bell & Search (⌘K) on Right */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-white/95 px-6 py-3.5 backdrop-blur-xs">
            {/* Working Shadcn Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/" />}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                {activeStock ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href="#dashboard"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedStockId(null);
                        }}
                        className="cursor-pointer"
                      >
                        Dashboard
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeStock.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {activeNav === "watchlist"
                        ? "Watchlist"
                        : activeNav === "portfolio"
                          ? "Portfolio"
                        : activeNav === "orders"
                          ? "Orders"
                          : "Dashboard"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5">
              {/* Notification Bell */}
              <Link
                href="/notifications"
                title="Notifications"
                aria-label="Notifications"
                className="flex size-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 cursor-pointer"
              >
                <Bell className="size-4" />
              </Link>

              {/* Search Input with ⌘K */}
              <div className="relative hidden sm:block w-52 lg:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search holdings.."
                  className="h-9 w-full rounded-lg border border-zinc-200/80 bg-[#F8FAFC] pl-8 pr-12 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  ⌘K
                </kbd>
              </div>
            </div>
          </header>

          {/* =====================================================================
              VIEW 1: DEFAULT HOLDINGS & PORTFOLIO OVERVIEW (selectedStockId === null)
             ===================================================================== */}
          {activeNav === "portfolio" ? (
            <DashboardPortfolio />
          ) : activeNav === "orders" ? (
            <DashboardOrders />
          ) : activeNav === "watchlist" ? (
            <DashboardWatchlist />
          ) : !activeStock ? (
            <div className="flex-1 p-6 space-y-7">
              {/* Portfolio Performance Graph */}
              <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 px-5 py-5 sm:px-6">
                  <div>
                    <p className="text-xs font-medium text-zinc-400">Portfolio performance</p>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
                      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">₹8,17,860</h1>
                      <span className="text-xs font-semibold text-emerald-600">▲ 15.68%</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Portfolio value over time</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-lg border border-zinc-200/80 bg-zinc-50 p-0.5">
                      {portfolioPeriods.map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setPortfolioPeriod(period)}
                          className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${portfolioPeriod === period ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-400 hover:text-zinc-800"}`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-5 sm:px-6">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="size-2 rounded-full bg-[#2563EB]" />Portfolio value
                  </div>
                  <svg
                    role="img"
                    aria-label={`Portfolio value chart for ${portfolioPeriod}`}
                    viewBox={`0 0 ${portfolioChartWidth} ${portfolioChartHeight}`}
                    className="mt-3 h-52 w-full overflow-visible sm:h-60"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="portfolio-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3].map((line) => (
                      <line key={line} x1="0" x2={portfolioChartWidth} y1={(portfolioChartHeight / 3) * line} y2={(portfolioChartHeight / 3) * line} stroke="#E4E4E7" strokeDasharray="4 6" />
                    ))}
                    <path d={portfolioAreaPath} fill="url(#portfolio-area-fill)" />
                    <path d={portfolioLinePath} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    {portfolioPoints.map((point, index) => (
                      index === portfolioPoints.length - 1 ? <circle key={index} cx={point.x} cy={point.y} r="5" fill="#2563EB" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : null
                    ))}
                  </svg>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>{portfolioPeriod === "1M" ? "1 month ago" : `${portfolioPeriod} ago`}</span>
                    <span>Today</span>
                  </div>
                </div>
              </section>

              {/* YOUR HOLDINGS LIST (Click any stock to open Detailed View) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Your Top Holdings ({filteredHoldings.length})
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Select any stock below to inspect its detailed chart,
                      fundamentals, and your position
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          <th className="py-3 pl-5 pr-4">Stock / Company</th>
                          <th className="py-3 px-4">Shares</th>
                          <th className="py-3 px-4">Avg Buy Price</th>
                          <th className="py-3 px-4">Current Price</th>
                          <th className="py-3 px-4">Total Invested</th>
                          <th className="py-3 px-4">Current Value</th>
                          <th className="py-3 px-4">Profit / Loss</th>
                          <th className="py-3 px-4">Trend (7D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-xs">
                        {filteredHoldings.map((st) => (
                          <tr
                            key={st.id}
                            className="hover:bg-[#F8FAFC] transition-colors"
                          >
                            <td className="py-4 pl-5 pr-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                                  style={{
                                    backgroundColor: st.logoBg,
                                    color: st.logoColor || "#2563EB",
                                  }}
                                >
                                  {st.logoText}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                  <span className="font-semibold text-zinc-900">
                                      {st.name}
                                    </span>
                                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                                      {st.marketType}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-zinc-400">
                                    {st.ticker} • {st.sector}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4 font-semibold text-zinc-900">
                              {st.position.totalShares}
                            </td>

                            <td className="py-4 px-4 text-zinc-600">
                              {st.position.avgBuyPrice}
                            </td>

                            <td className="py-4 px-4">
                              <span className="font-bold text-zinc-900">
                                {st.price}
                              </span>
                              <span className="ml-1.5 text-[11px] font-semibold text-emerald-600">
                                ▲ {st.changePct}
                              </span>
                            </td>

                            <td className="py-4 px-4 font-medium text-zinc-700">
                              {st.position.totalInvested}
                            </td>

                            <td className="py-4 px-4 font-bold text-zinc-900">
                              {st.position.currentValue}
                            </td>

                            <td className="py-4 px-4">
                              <span className="font-bold text-emerald-600">
                                {st.position.profitLoss}
                              </span>
                              <span className="block text-[10px] font-semibold text-emerald-600">
                                ▲ {st.position.profitPct}
                              </span>
                            </td>

                            <td className="py-4 px-4">
                              <div className="h-7 w-24">
                                <svg
                                  viewBox="0 0 132 32"
                                  className="h-full w-full overflow-visible"
                                  preserveAspectRatio="none"
                                >
                                  <path
                                    d={`${st.sparkline} L132 32 L0 32 Z`}
                                    fill="rgba(34,197,94,0.12)"
                                  />
                                  <path
                                    d={st.sparkline}
                                    fill="none"
                                    stroke="#22C55E"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Columns: Recent Transactions & You May Also Like */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Recent Transactions (5 cols) */}
                <div className="rounded-xl border border-zinc-200/80 bg-white p-5 lg:col-span-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Recent Deal Settlements
                    </h3>
                    <span className="text-[11px] text-zinc-400">
                      NSDL Off-Market
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100 text-xs">
                    {recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedStockId(tx.stockId)}
                        className="flex items-center justify-between py-3 hover:bg-zinc-50/70 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {tx.type}
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {tx.stockName}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {tx.shares} Shares @ {tx.price} • {tx.date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{tx.amount}</p>
                          <p className="text-[10px] font-medium text-emerald-600">
                            ✓ {tx.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* You May Also Like (7 cols) */}
                <div className="rounded-xl border border-zinc-200/80 bg-white p-5 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      You May Also Like
                    </h3>
                    <div className="inline-flex rounded-lg border border-zinc-200/80 bg-zinc-50 p-0.5 text-[11px]">
                      {(["24h", "7d", "30d"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setRecPeriod(p)}
                          className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                            recPeriod === p
                              ? "bg-white text-zinc-900 shadow-2xs"
                              : "text-zinc-400 hover:text-zinc-800"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {youMayAlsoLike.map((card) => (
                      <Link
                        key={card.id}
                        href={`/stocks/${card.id}`}
                        className="group flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                      >
                        <div className="flex items-center gap-2.5">
                          {card.logo}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-[#2563EB]">
                              {card.name}
                            </p>
                            <p className="truncate text-[10px] text-zinc-400">
                              {card.sector}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-zinc-900">
                            {card.price}
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${
                              card.isPositive
                                ? "text-emerald-600"
                                : "text-rose-500"
                            }`}
                          >
                            {card.isPositive ? "▲" : "▼"} {card.change}
                          </span>
                        </div>

                        <div className="mt-2.5 h-8 w-full overflow-hidden">
                          <svg
                            viewBox="0 0 132 32"
                            className="h-full w-full overflow-visible"
                            preserveAspectRatio="none"
                          >
                            <path
                              d={`${card.sparkline} L132 32 L0 32 Z`}
                              fill={
                                card.isPositive
                                  ? "rgba(34,197,94,0.12)"
                                  : "rgba(244,63,94,0.12)"
                              }
                            />
                            <path
                              d={card.sparkline}
                              fill="none"
                              stroke={card.isPositive ? "#22C55E" : "#F43F5E"}
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =====================================================================
               VIEW 2: DETAILED STOCK VIEW (Shown when user clicks a stock in Holdings)
               ===================================================================== */
            <div className="grid flex-1 grid-cols-1 lg:grid-cols-12">
              {/* ======== LEFT COLUMN: Stock Overview, Detail Product, Risk & Your Position ======== */}
                <div className="border-b border-zinc-100 p-6 lg:col-span-4 lg:border-b-0 lg:border-r">
                  {/* Stock Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-10 items-center justify-center rounded-full text-sm font-bold"
                        style={{
                          backgroundColor: activeStock.logoBg,
                          color: activeStock.logoColor || "#2563EB",
                        }}
                      >
                        {activeStock.logoText}
                      </div>
                      <div>
                        <h1 className="text-base font-semibold text-zinc-900 leading-tight">
                          {activeStock.name}
                        </h1>
                        <p className="text-xs text-zinc-400">
                          {activeStock.sector}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Share stock"
                        className="flex size-8 items-center justify-center rounded-lg border border-zinc-200/80 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                      >
                        <Share2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStarred((p) => !p)}
                        aria-label="Bookmark stock"
                        className="flex size-8 items-center justify-center rounded-lg border border-zinc-200/80 hover:bg-zinc-50 cursor-pointer"
                      >
                        <Star
                          className={`size-3.5 ${
                            isStarred
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-400"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Price + Overnight */}
                  <div className="mt-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-zinc-900">
                        {activeStock.price}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        ▲ {activeStock.changePct}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Overnight{" "}
                      <span className="font-medium text-zinc-700">
                        {activeStock.overnightPrice}
                      </span>{" "}
                      <span className="font-medium text-emerald-600">
                        ▲ {activeStock.overnightChange}
                      </span>
                    </p>
                  </div>

                  {/* Sell / Buy Action Buttons */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="h-10 rounded-xl bg-[#FDF2F2] text-xs font-semibold text-[#E11D48] transition-colors hover:bg-rose-100 cursor-pointer"
                    >
                      Sell
                    </button>
                    <Link
                      href={`/stocks/${activeStock.id}`}
                      className="flex h-10 items-center justify-center rounded-xl bg-[#1E2433] text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
                    >
                      Buy
                    </Link>
                  </div>

                  {/* Detail Product */}
                  <div className="mt-7">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Detail Product
                    </h2>
                    <div className="mt-3 divide-y divide-zinc-100 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-zinc-500">Market cap</span>
                        <span className="font-semibold text-zinc-900">
                          {activeStock.marketCap}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-zinc-500">Volume (24h)</span>
                        <span className="font-semibold text-zinc-900">
                          {activeStock.volume24h}{" "}
                          <span className="text-[11px] font-medium text-rose-500">
                            ▼ {activeStock.volumeChange}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-zinc-500">P/E Ratio</span>
                        <span className="font-semibold text-zinc-900">
                          {activeStock.peRatio}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-zinc-500">52W High</span>
                        <span className="font-semibold text-zinc-900">
                          {activeStock.high52w}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-zinc-500">52W Low</span>
                        <span className="font-semibold text-zinc-900">
                          {activeStock.low52w}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Overall Risk Dark Card */}
                  <div className="mt-5 rounded-xl bg-[#23293A] p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-200">
                        Overall Risk
                      </span>
                      <span className="rounded-md bg-[#22C55E] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {activeStock.riskLevel}
                      </span>
                    </div>

                    <div className="relative mt-4 h-2 w-full rounded-full bg-linear-to-r from-[#22C55E] via-[#EAB308] to-[#EF4444]">
                      <div
                        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#22C55E] shadow"
                        style={{ left: `${activeStock.riskPositionPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Your Position */}
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Your Position
                    </h2>

                    <div className="mt-3 rounded-xl border border-zinc-100 bg-[#F8FAFC]/60 p-4">
                      {/* Top 2 Cols */}
                      <div className="grid grid-cols-2 border-b border-zinc-100 pb-3 text-center">
                        <div className="border-r border-zinc-100 pr-2">
                          <p className="text-[11px] text-zinc-400">
                            Total Shares
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-900">
                            {activeStock.position.totalShares}
                          </p>
                        </div>
                        <div className="pl-2">
                          <p className="text-[11px] text-zinc-400">
                            Avg Buy Price
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-900">
                            {activeStock.position.avgBuyPrice}
                          </p>
                        </div>
                      </div>

                      {/* Middle Centered Row */}
                      <div className="border-b border-zinc-100 py-3 text-center">
                        <p className="text-[11px] text-zinc-400">
                          Total Invested
                        </p>
                        <p className="mt-1 text-sm font-bold text-zinc-900">
                          {activeStock.position.totalInvested}
                        </p>
                      </div>

                      {/* Bottom 2 Cols */}
                      <div className="grid grid-cols-2 pt-3 text-center">
                        <div className="border-r border-zinc-100 pr-2">
                          <p className="text-[11px] text-zinc-400">
                            Current Value
                          </p>
                          <p className="mt-1 text-sm font-bold text-zinc-900">
                            {activeStock.position.currentValue}
                          </p>
                        </div>
                        <div className="pl-2">
                          <p className="text-[11px] text-zinc-400">
                            Profit/Loss
                          </p>
                          <p className="mt-1 text-xs font-bold text-emerald-600">
                            {activeStock.position.profitLoss}{" "}
                            <span className="text-[10px]">
                              ▲ {activeStock.position.profitPct}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ======== RIGHT COLUMN: Interactive Chart & You May Also Like ======== */}
                <div className="flex flex-col justify-between p-6 lg:col-span-8">
                  <div>
                    {/* Chart Controls Bar: Price / Market Cap toggle on Left + Timeframes on Right */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex rounded-xl bg-zinc-100 p-1">
                        {(["Price", "Market Cap"] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setChartMetric(tab)}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              chartMetric === tab
                                ? "bg-white text-zinc-900 shadow-2xs"
                                : "text-zinc-500 hover:text-zinc-900"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        {timeframes.map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => setActiveTimeframe(tf)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              activeTimeframe === tf
                                ? "bg-[#1E2433] text-white"
                                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Main Interactive Step/Area Chart */}
                    <div className="relative mt-5 select-none">
                      <div className="flex">
                        {/* SVG Chart Area */}
                        <div className="relative flex-1 overflow-hidden">
                          <svg
                            viewBox={`0 0 ${chartW} ${chartH}`}
                            className="h-[260px] w-full overflow-visible"
                            onMouseMove={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const relX = Math.max(
                                0,
                                Math.min(1, (e.clientX - rect.left) / rect.width)
                              );
                              const idx = Math.round(relX * (pts.length - 1));
                              setHoverIdx(idx);
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="dashboardChartGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#22C55E"
                                  stopOpacity="0.24"
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#22C55E"
                                  stopOpacity="0.02"
                                />
                              </linearGradient>
                            </defs>

                            {/* Horizontal Grid Lines */}
                            {[0.15, 0.35, 0.55, 0.75, 0.92].map((ratio, i) => (
                              <line
                                key={i}
                                x1={0}
                                y1={chartH * ratio}
                                x2={chartW}
                                y2={chartH * ratio}
                                stroke="#F1F5F9"
                                strokeWidth="1"
                              />
                            ))}

                            {/* Vertical Grid Lines */}
                            {[0.18, 0.38, 0.58, 0.78].map((ratio, i) => (
                              <line
                                key={i}
                                x1={chartW * ratio}
                                y1={0}
                                x2={chartW * ratio}
                                y2={chartH}
                                stroke="#F1F5F9"
                                strokeWidth="1"
                              />
                            ))}

                            {/* Shaded Area */}
                            <path
                              d={areaPath}
                              fill="url(#dashboardChartGrad)"
                            />

                            {/* Main Green Line */}
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#22C55E"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />

                            {/* Bottom Volume Histogram Bars */}
                            {coords.map((pt, i) => {
                              const barH = 12 + ((i * 17) % 26);
                              const isUp = i % 3 !== 0;
                              return (
                                <line
                                  key={i}
                                  x1={pt.x}
                                  y1={chartH}
                                  x2={pt.x}
                                  y2={chartH - barH}
                                  stroke={isUp ? "#BBF7D0" : "#FECDD3"}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                              );
                            })}

                            {/* Dashed Crosshair Lines */}
                            <line
                              x1={activePoint.x}
                              y1={0}
                              x2={activePoint.x}
                              y2={chartH}
                              stroke="#94A3B8"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <line
                              x1={0}
                              y1={activePoint.y}
                              x2={chartW}
                              y2={activePoint.y}
                              stroke="#94A3B8"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />

                            {/* Active Point Dot */}
                            <circle
                              cx={activePoint.x}
                              cy={activePoint.y}
                              r="4.5"
                              fill="#1E2433"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          </svg>

                          {/* Floating Tooltip Card */}
                          <div
                            className="pointer-events-none absolute top-10 -translate-x-1/2 rounded-xl border border-zinc-100 bg-white px-3.5 py-2.5 shadow-md"
                            style={{
                              left: `${Math.min(
                                82,
                                Math.max(18, (hoverIdx / (pts.length - 1)) * 100)
                              )}%`,
                            }}
                          >
                            <div className="flex items-center justify-between gap-4 text-[11px]">
                              <span className="font-semibold text-zinc-900">
                                04/01/2026
                              </span>
                              <span className="text-zinc-400">08:50</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              Price:{" "}
                              <strong className="font-bold text-zinc-900">
                                ₹{displayHoverPrice}
                              </strong>
                            </p>
                          </div>

                          {/* Bottom Time Axis */}
                          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                            <span>Apr</span>
                            <span>03:00</span>
                            <span>06:00</span>
                            <span className="rounded-md bg-[#1E2433] px-2.5 py-0.5 text-[10px] font-medium text-white">
                              1 Apr 2026 08:50
                            </span>
                            <span>12:00</span>
                            <span>15:00</span>
                          </div>
                        </div>

                        {/* Right Y-Axis Price Labels & Highlight Pills */}
                        <div className="flex w-16 flex-col justify-between pb-6 pl-2 text-right text-[11px] text-zinc-400">
                          <span>260.00</span>
                          <span className="inline-block rounded bg-[#22C55E] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                            258.12
                          </span>
                          <span>240.00</span>
                          <span>220.00</span>
                          <span className="inline-block rounded bg-[#1E2433] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                            212.18
                          </span>
                          <span>200.00</span>
                          <span>180.00</span>
                          <span>160.00</span>
                          <span>140.00</span>
                          <span>120.00</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* You May Also Like (4 Mini Stock Sparkline Cards) */}
                  <div className="mt-8 border-t border-zinc-100 pt-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-900">
                        You May Also Like
                      </h3>
                      <div className="inline-flex rounded-lg border border-zinc-200/80 bg-zinc-50 p-0.5 text-[11px]">
                        {(["24h", "7d", "30d"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setRecPeriod(p)}
                            className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                              recPeriod === p
                                ? "bg-white text-zinc-900 shadow-2xs"
                                : "text-zinc-400 hover:text-zinc-800"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                      {youMayAlsoLike.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            const match = dashboardStocks.find(
                              (s) => s.id === card.id
                            );
                            if (match) {
                              setSelectedStockId(match.id);
                            }
                          }}
                          className="group flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {card.logo}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-[#2563EB]">
                                {card.name}
                              </p>
                              <p className="truncate text-[10px] text-zinc-400">
                                {card.sector}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-zinc-900">
                              {card.price}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                card.isPositive
                                  ? "text-emerald-600"
                                  : "text-rose-500"
                              }`}
                            >
                              {card.isPositive ? "▲" : "▼"} {card.change}
                            </span>
                          </div>

                          {/* Mini Sparkline SVG */}
                          <div className="mt-2.5 h-8 w-full overflow-hidden">
                            <svg
                              viewBox="0 0 132 32"
                              className="h-full w-full overflow-visible"
                              preserveAspectRatio="none"
                            >
                              <path
                                d={`${card.sparkline} L132 32 L0 32 Z`}
                                fill={
                                  card.isPositive
                                    ? "rgba(34,197,94,0.12)"
                                    : "rgba(244,63,94,0.12)"
                                }
                              />
                              <path
                                d={card.sparkline}
                                fill="none"
                                stroke={card.isPositive ? "#22C55E" : "#F43F5E"}
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
