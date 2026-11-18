"use client";

import { useState, useMemo } from "react";

const timeframes = ["1H", "24H", "1W", "1M", "1Y", "3Y"] as const;
type Timeframe = (typeof timeframes)[number];

const xAxisLabels = [
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "15:00",
];

type StockChartProps = {
  exchange: string;
  lastUpdated: string;
  currentPrice: number;
  baseSeries: number[];
};

export function StockChart({
  lastUpdated,
  currentPrice,
  baseSeries,
}: StockChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1M");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate timeframe-specific variations while ending at currentPrice
  const activeSeries = useMemo(() => {
    const multipliers: Record<Timeframe, number> = {
      "1H": 0.25,
      "24H": 0.45,
      "1W": 0.7,
      "1M": 1,
      "1Y": 1.35,
      "3Y": 1.65,
    };
    const mult = multipliers[selectedTimeframe];
    const lastVal = baseSeries[baseSeries.length - 1] || currentPrice;

    return baseSeries.map((val, idx) => {
      if (idx === baseSeries.length - 1) return currentPrice;
      const diff = val - lastVal;
      return Math.round(currentPrice + diff * mult);
    });
  }, [baseSeries, currentPrice, selectedTimeframe]);

  // Compute Y-axis bounds & ticks
  const { minVal, maxVal, yTicks } = useMemo(() => {
    const rawMin = Math.min(...activeSeries);
    const rawMax = Math.max(...activeSeries);
    const range = Math.max(rawMax - rawMin, 20);
    const step = range <= 160 ? 20 : Math.ceil(range / 7 / 10) * 10;
    const min = Math.floor((rawMin - step * 0.8) / step) * step;
    const max = Math.ceil((rawMax + step * 0.4) / step) * step;

    const ticks: number[] = [];
    for (let v = min; v <= max; v += step) {
      ticks.push(v);
    }
    return { minVal: min, maxVal: max, yTicks: ticks.reverse() };
  }, [activeSeries]);

  // SVG coordinate dimensions
  const width = 760;
  const height = 270;
  const padLeft = 6;
  const padRight = 6;
  const padTop = 16;
  const padBottom = 16;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getCoordinates = (val: number, idx: number) => {
    const x =
      padLeft +
      (idx / Math.max(activeSeries.length - 1, 1)) * plotWidth;
    const yRatio = (val - minVal) / Math.max(maxVal - minVal, 1);
    const y = padTop + plotHeight - yRatio * plotHeight;
    return { x, y };
  };

  const polylinePoints = activeSeries
    .map((val, idx) => {
      const { x, y } = getCoordinates(val, idx);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const hoveredPoint =
    hoverIndex !== null && activeSeries[hoverIndex] !== undefined
      ? {
          price: activeSeries[hoverIndex],
          ...getCoordinates(activeSeries[hoverIndex], hoverIndex),
        }
      : null;

  return (
    <div className="w-full">
      {/* Top Toolbar: Timestamp + Timeframe Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-500">{lastUpdated}</span>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1.5">
          {timeframes.map((tf) => {
            const isSelected = selectedTimeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTimeframe(tf)}
                className={`h-9 min-w-[38px] rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#0E171B] text-white"
                    : "border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chart + Y-Axis Layout */}
      <div className="mt-6 flex items-stretch gap-3">
        {/* SVG Line Chart */}
        <div
          className="relative flex-1 select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[250px] sm:h-[280px] w-full overflow-visible"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const idx = Math.round(relX * (activeSeries.length - 1));
              setHoverIndex(idx);
            }}
          >
            {/* Price Line */}
            <polyline
              fill="none"
              stroke="#4D9A78"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />

            {/* Interactive Hover Crosshair & Dot */}
            {hoveredPoint && (
              <g>
                <line
                  x1={hoveredPoint.x}
                  y1={padTop}
                  x2={hoveredPoint.x}
                  y2={height - padBottom}
                  stroke="#E4E4E7"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4"
                  fill="#4D9A78"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* Hover Price Pill Tooltip */}
          {hoveredPoint && (
            <div
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${Math.max(0, (hoveredPoint.y / height) * 100 - 14)}%`,
              }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded bg-[#0E171B] px-2 py-1 text-[11px] font-medium text-white shadow-sm"
            >
              {hoveredPoint.price}
            </div>
          )}

          {/* X-Axis Day/Time Ticks */}
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-zinc-600">
            {xAxisLabels.map((label, idx) => (
              <span
                key={idx}
                className={
                  idx % 2 === 1 && idx !== xAxisLabels.length - 1
                    ? "hidden sm:inline"
                    : ""
                }
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Right Y-Axis Price Scale + Highlighted Current Price Badge */}
        <div className="flex flex-col justify-between pb-6 pt-1 text-right text-[11px] text-zinc-600 shrink-0">
          {/* Highlighted Current Price Green Pill at Top of Scale */}
          <span className="inline-flex items-center justify-center rounded bg-[#4D9A78] px-1.5 py-0.5 text-[11px] font-medium text-white">
            {currentPrice}
          </span>

          {yTicks.map((tick) => (
            <span key={tick} className="leading-none pr-0.5">
              {tick}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

