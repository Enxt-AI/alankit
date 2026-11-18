"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Helper for currency formatting
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export function PortfolioCharts() {
  // P&L Trend data
  const plTrendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return months.map((month, index) => ({
      date: month,
      value: 1500 + index * 250 + (Math.random() - 0.5) * 400,
    }));
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-end pb-4 pt-4">
        {/* Time Period Selectors */}
        <div className="flex space-x-1 overflow-x-auto">
          {["1H", "1W", "1M", "6M", "1Y", "YTD"].map((period) => (
            <button
              key={period}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === "YTD"
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-[220px] md:h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={plTrendData}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                dy={10}
              />
              <YAxis
                tickFormatter={(value) => `₹${value}`}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                width={60}
                domain={[1500, 4000]}
                ticks={[1500, 2000, 2500, 3000, 3500, 4000]}
              />
              <Tooltip
                formatter={(value: number) => [
                  formatCurrency(value),
                  "Portfolio Value",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}