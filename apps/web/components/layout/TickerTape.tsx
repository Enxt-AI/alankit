"use client";
import React, { useMemo } from "react";
import { useStocks } from "@/hooks/use-stocks";

const fallbackData = [
  { label: "NIFTY 50", value: "19,745.00", change: "+0.85%", up: true },
  { label: "SENSEX", value: "66,230.15", change: "+1.12%", up: true },
  { label: "BANK NIFTY", value: "44,850.30", change: "-0.45%", up: false },
  { label: "NASDAQ", value: "15,630.00", change: "+2.30%", up: true },
  { label: "GOLD", value: "62,450", change: "+0.65%", up: true },
];

export default function TickerTape() {
  const { data: stocks } = useStocks();

  const displayData = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return fallbackData;
    }

    return stocks.slice(0, 15).map((stock) => {
      const changePercent = stock.changePercent ?? 0;
      const up = changePercent >= 0;
      const changeStr = `${up ? "+" : ""}${changePercent.toFixed(2)}%`;

      return {
        label: stock.name,
        value: `${stock.price.toLocaleString("en-IN")}`,
        change: changeStr,
        up,
      };
    });
  }, [stocks]);

  return (
    <div className="w-full bg-[#0a0a0a] border-y border-white/5 shadow-sm select-none py-0.5">
      <div className="mx-auto w-[97%] max-w-[97%] overflow-hidden h-4 md:h-6 flex items-center text-[9px] md:text-[11px] font-medium tracking-wide">
        {/* SCROLL WRAPPER */}
        <div className="flex items-center w-max animate-infinite-scroll">
          {/* duplicate data for seamless loop */}
          {[...displayData, ...displayData, ...displayData, ...displayData].map(
            (item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                <div className="flex items-center gap-1.5 px-3 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity">
                  <span className="text-white font-medium uppercase">
                    {item.label}
                  </span>

                  <span
                    className={`font-semibold font-mono ${item.up ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {item.value}
                  </span>

                  {item.change && (
                    <span
                      className={`font-semibold font-mono ${item.up ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {item.change}
                    </span>
                  )}
                </div>

                {/* Thin vertical line separator */}
                <div className="h-2.5 w-[1px] bg-white/20" />
              </React.Fragment>
            ),
          )}
        </div>
      </div>

      <style jsx>{`
        .animate-infinite-scroll {
          animation: infinite-scroll 130s linear infinite;
        }
        .animate-infinite-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes infinite-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
