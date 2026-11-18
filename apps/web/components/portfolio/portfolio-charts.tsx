"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function PortfolioCharts({ 
  dailyTrend,
  trend,
  weeklyTrend,
  yearlyTrend
}: { 
  dailyTrend?: { date: string; value: number }[];
  trend?: { date: string; value: number }[];
  weeklyTrend?: { date: string; value: number }[];
  yearlyTrend?: { date: string; value: number }[];
}) {
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M" | "3M" | "1Y" | "All">("1M");

  const chartData = useMemo(() => {
    switch (timeframe) {
      case "1D":
        return dailyTrend?.slice(-2) || [];
      case "1W":
        return dailyTrend?.slice(-7) || [];
      case "1M":
        return dailyTrend || [];
      case "3M":
        return weeklyTrend || [];
      case "1Y":
        return trend || [];
      case "All":
        return yearlyTrend || [];
      default:
        return dailyTrend || [];
    }
  }, [timeframe, dailyTrend, trend, weeklyTrend, yearlyTrend]);

  const lastPoint = chartData[chartData.length - 1];

  const timeframes = ["1D", "1W", "1M", "3M", "1Y", "All"] as const;

  return (
    <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl col-span-1 md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-6 pt-6 px-6">
        <CardTitle className="text-[15px] font-bold tracking-tight text-slate-900">
          Portfolio Performance
        </CardTitle>

        {/* Custom Tabs */}
        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-[13px] font-medium rounded-full transition-colors ${
                timeframe === tf
                  ? "bg-[#e6f5ea] text-green-700"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                dy={10}
                minTickGap={20}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(val) => {
                  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
                  if (val >= 100000) return `${(val / 100000).toFixed(0)}L`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                  return val.toString();
                }}
                domain={['auto', 'auto']}
                width={40}
              />

              <Tooltip
                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border border-slate-100 px-4 py-2 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex flex-col items-end">
                        <p className="text-slate-900 font-bold text-[13px]">
                          ₹ {payload[0].value?.toLocaleString("en-IN")}
                        </p>
                        <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                          {payload[0].payload.date}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#16a34a"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorValue)"
                activeDot={{ r: 6, fill: "#16a34a", stroke: "#fff", strokeWidth: 2 }}
              />
              
              {/* Permanent dot at the end */}
              {lastPoint && (
                <ReferenceDot
                  x={lastPoint.date}
                  y={lastPoint.value}
                  r={5}
                  fill="#16a34a"
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}