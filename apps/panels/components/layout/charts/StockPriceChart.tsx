"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useState } from "react";

type PricePoint = {
  label: string;
  price: number;
};

type ChartData = {
  "1D": PricePoint[];
  "1W": PricePoint[];
  "1M": PricePoint[];
  "1Y": PricePoint[];
  All: PricePoint[];
};

const rangeLabels: Record<keyof ChartData, string> = {
  "1D": "Daily",
  "1W": "Weekly",
  "1M": "Monthly",
  "1Y": "Yearly",
  All: "All",
};

export function StockPriceChart() {
  const [range, setRange] = useState<keyof ChartData>("1Y");

  //  Dummy Data inside component
  const data: ChartData = {
    "1D": [
      { label: "09:00", price: 95 },
      { label: "12:00", price: 97 },
      { label: "15:00", price: 99 },
      { label: "18:00", price: 101 },
    ],
    "1W": [
      { label: "Mon", price: 92 },
      { label: "Tue", price: 94 },
      { label: "Wed", price: 93 },
      { label: "Thu", price: 95 },
      { label: "Fri", price: 98 },
      { label: "Sat", price: 100 },
      { label: "Sun", price: 101 },
    ],
    "1M": [
      { label: "01 Jun", price: 90 },
      { label: "08 Jun", price: 95 },
      { label: "15 Jun", price: 98 },
      { label: "22 Jun", price: 101 },
    ],
    "1Y": [
      { label: "Jan", price: 70 },
      { label: "Feb", price: 75 },
      { label: "Mar", price: 78 },
      { label: "Apr", price: 82 },
      { label: "May", price: 85 },
      { label: "Jun", price: 90 },
      { label: "Jul", price: 92 },
      { label: "Aug", price: 95 },
      { label: "Sep", price: 99 },
      { label: "Oct", price: 105 },
      { label: "Nov", price: 110 },
      { label: "Dec", price: 120 },
    ],
    All: [
      { label: "2018", price: 30 },
      { label: "2019", price: 35 },
      { label: "2020", price: 40 },
      { label: "2021", price: 55 },
      { label: "2022", price: 60 },
      { label: "2023", price: 85 },
      { label: "2024", price: 120 },
      { label: "2025", price: 140 },
    ],
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Stock Price History</h2>

        <div className="flex gap-3 text-xs text-gray-500">
          {["1D", "1W", "1M", "1Y", "All"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as keyof ChartData)}
              className={`px-2 py-1 rounded ${range === r ? "bg-green-600 text-white" : "hover:text-black"
                }`}
            >
              {rangeLabels[r as keyof ChartData]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[330px] w-full mt-5 text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data[range]}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#000000", fontSize: 12 }}
              tickLine={false}
              padding={{ left: 18 }}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#000000", fontSize: 12 }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip formatter={(v) => `$${v}`} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
