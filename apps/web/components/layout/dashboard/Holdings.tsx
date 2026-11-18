"use client";

import { Download } from "lucide-react";

type Holding = {
  name: string;
  shares: number;
  value: string;
  change: string;
  changePositive: boolean;
  currentPrice: number;
  invested: string;
  pl: string;
  plPositive: boolean;
  symbol: string;
};

const holdings: Holding[] = [
  {
    name: "Reliance Industries",
    shares: 50,
    value: "₹1,24,500",
    change: "+8.5%",
    changePositive: true,
    currentPrice: 2680.5,
    invested: "1,34,025.00",
    pl: "9.41%",
    plPositive: true,
    symbol: "R",
  },
  {
    name: "TCS",
    shares: 35,
    value: "₹1,18,650",
    change: "+12.3%",
    changePositive: true,
    currentPrice: 3580.75,
    invested: "1,07,422.50",
    pl: "4.85%",
    plPositive: true,
    symbol: "T",
  },
  {
    name: "Infosys",
    shares: 80,
    value: "₹1,12,800",
    change: "+6.7%",
    changePositive: true,
    currentPrice: 1645.2,
    invested: "1,52,030.00",
    pl: "4.13%",
    plPositive: true,
    symbol: "I",
  },
  {
    name: "HDFC Bank",
    shares: 45,
    value: "₹67,500",
    change: "-2.1%",
    changePositive: false,
    currentPrice: 875.5,
    invested: "52,530.00",
    pl: "-4.84%",
    plPositive: false,
    symbol: "H",
  },
];

export default function Holdings() {
  return (
    <div className="rounded-2xl bg-linear-to-b from-zinc-900 to-zinc-950 p-8 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Stock <span className="text-emerald-500">Holdings</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Detailed breakdown of your portfolio
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200">
            <Download size={16} />
            Export CSV
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-5 px-4 py-2 text-sm text-zinc-400">
        <span>Top Performers</span>
        <span className="text-right">Current Price</span>
        <span className="text-right">Invested</span>
        <span className="text-right">P&amp;L %</span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-4 mt-4">
        {holdings.map((item) => (
          <div
            key={item.name}
            className="grid grid-cols-5 items-center rounded-xl bg-black/60 px-4 py-4 shadow-inner"
          >
            {/* Stock Info */}
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-emerald-400 font-semibold">
                {item.symbol}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{item.name}</p>
                <p className="text-xs text-zinc-400">{item.shares} shares</p>
              </div>
            </div>

            {/* Value */}
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{item.value}</p>
              <p
                className={`text-xs ${
                  item.changePositive ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {item.change}
              </p>
            </div>

            {/* Current Price */}
            <div className="text-right text-sm text-white">
              {item.currentPrice}
            </div>

            {/* Invested */}
            <div className="text-right text-sm text-white">{item.invested}</div>

            {/* P&L */}
            <div
              className={`text-right text-sm font-medium ${
                item.plPositive ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {item.pl}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
