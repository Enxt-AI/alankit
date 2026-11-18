"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", value: 1800 },
  { month: "Feb", value: 2200 },
  { month: "Mar", value: 2900 },
  { month: "Apr", value: 3300 },
  { month: "May", value: 3100 },
  { month: "Jun", value: 2800 },
  { month: "Jul", value: 3200 },
  { month: "Aug", value: 3600 },
  { month: "Sep", value: 4000 },
];

export default function PortfolioChart() {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-gray-400 text-sm">Portfolio Overview</p>
          <h2 className="text-white font-semibold">Stock</h2>
        </div>

        <div className="flex gap-2">
          {["1H", "1W", "1M", "6M", "1Y", "YTD"].map((t) => (
            <button
              key={t}
              className={`px-3 py-1 rounded-md text-xs ${
                t === "YTD"
                  ? "bg-white text-black"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Detailed breakdown of your portfolio
      </p>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              fill="url(#color)"
            />
            <defs>
              <linearGradient id="color" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
