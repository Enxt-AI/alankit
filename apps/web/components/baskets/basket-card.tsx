"use client";

import Link from "next/link";
import { type KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";
import type { BasketWithConstituents } from "@/types/basket";

interface BasketCardProps {
  basket: BasketWithConstituents;
  onViewDetails: () => void;
}

export function BasketCard({ basket, onViewDetails }: BasketCardProps) {
  const basketUrl = `/baskets/${basket.slug || basket.id}`;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetails();
    }
  };

  const isOpen = basket.resolvedStatus === "OPEN";
  const isComingSoon = basket.resolvedStatus === "COMING_SOON";

  // Monochromatic green weight visualizer
  const segmentGreenShades = [
    "bg-green-600",
    "bg-green-500",
    "bg-green-400",
    "bg-green-300",
    "bg-gray-300",
  ];

  return (
    <Card
      className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:border-green-600 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={handleKeyDown}
      role="article"
      aria-label={`${basket.name} basket`}
    >
      <div className="p-5 sm:p-6 flex flex-col h-full">
        {/* Top Header: Icon, Category & Status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 sm:h-13 sm:w-13 shrink-0 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105">
              {basket.iconUrl ? (
                <img
                  src={basket.iconUrl}
                  alt={`${basket.name} icon`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`${
                  basket.iconUrl ? "hidden" : "flex"
                } items-center justify-center text-green-600`}
              >
                <Package className="h-6 w-6" />
              </div>
            </div>

            <div>
              <span className="inline-block text-[11px] font-bold text-green-600 uppercase tracking-wider">
                {basket.category}
              </span>
              <h3 className="line-clamp-1 text-base sm:text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors">
                <Link
                  href={basketUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:underline"
                >
                  {basket.name}
                </Link>
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              isOpen
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOpen ? "bg-green-600 animate-pulse" : "bg-gray-400"
              }`}
            />
            {isOpen ? "Open" : isComingSoon ? "Soon" : "Closed"}
          </span>
        </div>

        {/* Description */}
        {basket.description && (
          <p className="text-gray-500 text-xs sm:text-sm font-normal leading-relaxed line-clamp-2 mb-4">
            {basket.description}
          </p>
        )}

        {/* Constituent Stocks Preview */}
        <div className="mt-auto pt-2">
          {basket.constituents && basket.constituents.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mb-1.5">
                <span>Holdings Preview</span>
                <span className="font-semibold text-gray-700">
                  {basket.constituents.length} stocks
                </span>
              </div>

              {/* Stock Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {basket.constituents.slice(0, 3).map((c, i) => (
                  <span
                    key={c.id || i}
                    className="inline-flex items-center text-[10.5px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md truncate max-w-[130px]"
                    title={c.stock?.name}
                  >
                    {c.stock?.name || "Constituent"}
                  </span>
                ))}
                {basket.constituents.length > 3 && (
                  <span className="inline-flex items-center text-[10.5px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">
                    +{basket.constituents.length - 3} more
                  </span>
                )}
              </div>

              {/* Stacked Weight Bar (Green shades) */}
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                {basket.constituents.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    style={{ width: `${c.weight}%` }}
                    className={`${
                      segmentGreenShades[idx % segmentGreenShades.length]
                    } h-full border-r border-white/60 first:rounded-l-full last:rounded-r-full`}
                    title={`${c.stock?.name || "Stock"}: ${c.weight}%`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pricing & Metric Box */}
          <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Basket Price
              </p>
              <p className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                ₹{basket.currentPrice?.toLocaleString("en-IN") || "0"}
              </p>
            </div>
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Min. Investment
              </p>
              <p className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                ₹{(basket.minInvestment || basket.currentPrice || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Action CTA: Pure Green 600 */}
          <Button
            asChild
            className="w-full h-10 sm:h-11 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <Link href={basketUrl} onClick={(e) => e.stopPropagation()}>
              <span>Explore Basket</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * List / Table Row Presentation for Baskets (Green & White Theme)
 */
export function BasketListRow({
  basket,
  onViewDetails,
}: BasketCardProps) {
  const basketUrl = `/baskets/${basket.slug || basket.id}`;
  const isOpen = basket.resolvedStatus === "OPEN";

  return (
    <div
      onClick={onViewDetails}
      className="group bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 hover:border-green-600 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
    >
      {/* Left: Icon, Category & Name */}
      <div className="flex items-center gap-3.5 min-w-[280px]">
        <div className="h-12 w-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 overflow-hidden">
          {basket.iconUrl ? (
            <img
              src={basket.iconUrl}
              alt={basket.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Package className="h-5 w-5 text-green-600" />
          )}
        </div>
        <div>
          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
            {basket.category}
          </span>
          <h3 className="text-base font-bold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-1">
            {basket.name}
          </h3>
          <p className="text-xs text-gray-400 line-clamp-1 max-w-md mt-0.5">
            {basket.description || "Thematic unlisted stock portfolio."}
          </p>
        </div>
      </div>

      {/* Center: Constituent Stocks Chips */}
      <div className="hidden lg:flex items-center gap-1.5 flex-1 max-w-md">
        {basket.constituents?.slice(0, 3).map((c, i) => (
          <span
            key={i}
            className="text-[11px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md truncate max-w-[120px]"
          >
            {c.stock?.name}
          </span>
        ))}
        {basket.constituents && basket.constituents.length > 3 && (
          <span className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">
            +{basket.constituents.length - 3}
          </span>
        )}
      </div>

      {/* Right: Stocks count, Price, Status, CTA */}
      <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
        <div className="text-left md:text-right">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Price ({basket.constituents?.length || 0} stocks)
          </p>
          <p className="text-base font-black text-gray-900">
            ₹{basket.currentPrice?.toLocaleString("en-IN") || "0"}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isOpen
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-600 border border-gray-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isOpen ? "bg-green-600 animate-pulse" : "bg-gray-400"
            }`}
          />
          {isOpen ? "Open" : "Closed"}
        </span>

        <Button
          asChild
          size="sm"
          className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-xs transition-colors shrink-0"
        >
          <Link href={basketUrl} onClick={(e) => e.stopPropagation()}>
            Explore
          </Link>
        </Button>
      </div>
    </div>
  );
}
