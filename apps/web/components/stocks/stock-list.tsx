"use client";

import type { Stock, UpcomingStock } from "@/types/stock";
import { StockCard } from "./stock-card";
import { StockSkeleton } from "./stock-skeleton";
import { StockErrorState } from "./stock-error-state";
import { useState } from "react";
import { LayoutList, Grid2X2, Star, Loader2 } from "lucide-react";
import { cn, getStorageUrl } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

type DisplayStock = Stock | UpcomingStock;
type MobileView = "list" | "grid2";

interface StockListProps {
  stocks: DisplayStock[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onStockClick: (stock: DisplayStock) => void;
  onRetry: () => void;
  watchlistedStockIds?: Set<string>;
  togglingStockIds?: Set<string>;
  onToggleWatchlist?: (stock: DisplayStock, stockType?: 'regular' | 'upcoming') => void;
  stockType?: 'regular' | 'upcoming';
  isCarouselOnMobile?: boolean;
  onClearSearch?: () => void;
  onAdjustFilters?: () => void;
}

// Horizontal list card for mobile list view
function StockListCard({
  stock,
  onClick,
  isInWatchlist,
  isTogglingWatchlist,
  onToggleWatchlist,
  stockType,
}: {
  stock: DisplayStock;
  onClick: () => void;
  isInWatchlist?: boolean;
  isTogglingWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  stockType?: 'regular' | 'upcoming';
}) {
  const [imageError, setImageError] = useState(false);

  const cardLogo = stock.logoUrl || "";
  const cardName = stock.name || "";
  const cardCin = stock.cin || "";
  const cardPrice = stock.price || 0;
  const cardChange =
    stock.changePercent !== undefined && stock.changePercent !== null
      ? stock.changePercent
      : stock.change !== undefined && stock.change !== null
      ? stock.change
      : 0;
  const isPositive = cardChange > 0;
  const isNegative = cardChange < 0;
  const absChange = Math.abs(cardChange);
  const sign = cardChange > 0 ? "+" : cardChange < 0 ? "-" : "";
  const changeText = `${sign}${absChange.toFixed(2)}%`;

  return (
    <article
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm cursor-pointer active:scale-[0.99] transition-all duration-200 w-full"
    >
      {/* Logo */}
      <div className="w-11 h-11 shrink-0 rounded-lg bg-slate-50 p-1 flex items-center justify-center overflow-hidden">
        {cardLogo && !imageError ? (
          <img
            src={getStorageUrl(cardLogo)}
            alt={cardName}
            className="h-full w-full object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-50 to-green-100/80 text-green-700 font-bold text-xs flex items-center justify-center select-none rounded-lg">
            {cardName ? cardName.charAt(0).toUpperCase() : "?"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[13px] text-gray-900 truncate leading-tight">{cardName}</h3>
        {stockType === "upcoming" && (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700 mt-0.5">
            Coming Soon
          </span>
        )}
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{cardCin || "—"}</p>
      </div>

      {/* Price & Change */}
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold text-gray-900">₹{cardPrice.toLocaleString("en-IN")}</div>
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold mt-0.5",
            isPositive && "bg-green-50 text-green-700",
            isNegative && "bg-red-50 text-red-700",
            !isPositive && !isNegative && "bg-gray-100 text-gray-600"
          )}
        >
          {changeText}
        </span>
      </div>

      {/* Watchlist */}
      {onToggleWatchlist && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleWatchlist(); }}
          disabled={!!isTogglingWatchlist}
          className={cn(
            "shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all",
            isInWatchlist ? "text-yellow-500" : "text-gray-300",
            "hover:text-yellow-500 disabled:opacity-60"
          )}
        >
          {isTogglingWatchlist ? (
            <Star className="h-3.5 w-3.5 fill-yellow-500/50 text-yellow-500/50 animate-pulse" />
          ) : (
            <Star className={cn("h-3.5 w-3.5", isInWatchlist ? "fill-yellow-500" : "fill-transparent")} />
          )}
        </button>
      )}
    </article>
  );
}

export function StockList({
  stocks,
  isLoading,
  isError,
  error,
  onStockClick,
  onRetry,
  watchlistedStockIds,
  togglingStockIds,
  onToggleWatchlist,
  stockType,
  isCarouselOnMobile = false,
  onClearSearch,
  onAdjustFilters,
}: StockListProps) {
  // Default mobile view: grid for carousel/tiles, list otherwise
  const [mobileView, setMobileView] = useState<MobileView>("grid2");

  const viewButtons: { id: MobileView; icon: React.ReactNode; label: string }[] = [
    { id: "list", icon: <LayoutList className="h-4 w-4" />, label: "List view" },
    { id: "grid2", icon: <Grid2X2 className="h-4 w-4" />, label: "Grid view" },
  ];


  if (isLoading) {
    return (
      <div className="w-full mt-4 sm:mt-6">
        <div className="flex md:hidden justify-end mb-3 gap-1">
          {viewButtons.map((b) => (
            <div key={b.id} className="h-8 w-9 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 sm:gap-x-4 sm:gap-y-5 md:gap-x-6 md:gap-y-7 justify-center justify-items-center">
          {Array.from({ length: 8 }).map((_, index) => (
            <StockSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="w-full py-10">
        <StockErrorState
          type="error"
          title="Failed to Load Stocks"
          description={error?.message || "Unable to load stocks from the server. Please try again."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  // Empty State
  if (stocks.length === 0) {
    return (
      <div className="w-full py-10">
        <StockErrorState
          type="not-found"
          title="No Stocks Found"
          description="We couldn't find any stocks matching your current search criteria. Try adjusting your filters or search terms."
          onClearSearch={onClearSearch}
          onAdjustFilters={onAdjustFilters}
        />
      </div>
    );
  }

  const mobileGridClass =
    mobileView === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2";

  return (
    <div className="w-full mt-4 sm:mt-6">
      {/* Mobile View Toggle — only on mobile */}
      <div className="flex md:hidden justify-end items-center gap-1 mb-3">
        <span className="text-[11px] text-gray-400 mr-1 font-medium">View:</span>
        {viewButtons.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.label}
            onClick={() => setMobileView(b.id)}
            className={cn(
              "flex items-center justify-center h-8 w-9 rounded-lg border transition-all duration-200",
              mobileView === b.id
                ? "bg-[#0fac50] text-white border-[#0fac50] shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            )}
          >
            {b.icon}
          </button>
        ))}
      </div>

      {/* Mobile Layout */}
      {mobileView === "list" ? (
        isCarouselOnMobile ? (
          <div className="md:hidden w-full pb-6">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              plugins={[
                Autoplay({
                  delay: 3500,
                }),
              ]}
              className="w-full"
            >
              <CarouselContent>
                {Array.from({ length: Math.ceil(stocks.length / 4) }).map((_, slideIndex) => {
                  const chunk = stocks.slice(slideIndex * 4, slideIndex * 4 + 4);
                  return (
                    <CarouselItem key={slideIndex} className="basis-full">
                      <div className="flex flex-col gap-2 px-1">
                        {chunk.map((stock) => (
                          <StockListCard
                            key={stock.id}
                            stock={stock}
                            onClick={() => onStockClick(stock)}
                            isInWatchlist={watchlistedStockIds ? watchlistedStockIds.has(stock.id) : undefined}
                            isTogglingWatchlist={togglingStockIds ? togglingStockIds.has(stock.id) : undefined}
                            stockType={stockType}
                            onToggleWatchlist={
                              onToggleWatchlist ? () => onToggleWatchlist(stock, stockType) : undefined
                            }
                          />
                        ))}
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          </div>
        ) : (
          <div className="md:hidden flex flex-col gap-2 pb-6">
            {stocks.map((stock) => (
              <StockListCard
                key={stock.id}
                stock={stock}
                onClick={() => onStockClick(stock)}
                isInWatchlist={watchlistedStockIds ? watchlistedStockIds.has(stock.id) : undefined}
                isTogglingWatchlist={togglingStockIds ? togglingStockIds.has(stock.id) : undefined}
                stockType={stockType}
                onToggleWatchlist={
                  onToggleWatchlist ? () => onToggleWatchlist(stock, stockType) : undefined
                }
              />
            ))}
          </div>
        )
      ) : isCarouselOnMobile ? (
        <div className="md:hidden w-full pb-6">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: 3500,
            }),
          ]}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {/* Chunk stocks into pairs of 2 to create 2 rows per slide */}
            {Array.from({ length: Math.ceil(stocks.length / 2) }).map((_, slideIndex) => {
              const pair = stocks.slice(slideIndex * 2, slideIndex * 2 + 2);
              return (
                <CarouselItem key={slideIndex} className="pl-3 basis-[50%]">
                  <div className="flex flex-col gap-3">
                    {pair.map((stock) => {
                      const minQty = "minimumPurchaseQuantity" in stock ? stock.minimumPurchaseQuantity ?? 1 : 1;
                      const logo = stock.logoUrl || "";
                      const change =
                        stock.changePercent !== undefined && stock.changePercent !== null
                          ? stock.changePercent
                          : stock.change !== undefined && stock.change !== null
                          ? stock.change
                          : 0;
                      
                      return (
                        <StockCard
                          key={stock.id}
                          logo={logo}
                          name={stock.name}
                          cin={stock.cin || ""}
                          price={stock.price}
                          change={change}
                          marketCap={stock.marketCap || 0}
                          minQty={minQty}
                          stock={stock}
                          onClick={() => onStockClick(stock)}
                          isInWatchlist={watchlistedStockIds ? watchlistedStockIds.has(stock.id) : undefined}
                          isTogglingWatchlist={togglingStockIds ? togglingStockIds.has(stock.id) : undefined}
                          stockType={stockType}
                          onToggleWatchlist={
                            onToggleWatchlist ? () => onToggleWatchlist(stock, stockType) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
      ) : (
        <div className="md:hidden grid grid-cols-2 gap-2 pb-6">
          {stocks.map((stock) => {
            const minQty = "minimumPurchaseQuantity" in stock ? stock.minimumPurchaseQuantity ?? 1 : 1;
            const logo = stock.logoUrl || "";
            const change =
              stock.changePercent !== undefined && stock.changePercent !== null
                ? stock.changePercent
                : stock.change !== undefined && stock.change !== null
                ? stock.change
                : 0;

            return (
              <StockCard
                key={stock.id}
                logo={logo}
                name={stock.name}
                cin={stock.cin || ""}
                price={stock.price}
                change={change}
                marketCap={stock.marketCap || 0}
                minQty={minQty}
                stock={stock}
                onClick={() => onStockClick(stock)}
                isInWatchlist={watchlistedStockIds ? watchlistedStockIds.has(stock.id) : undefined}
                isTogglingWatchlist={togglingStockIds ? togglingStockIds.has(stock.id) : undefined}
                stockType={stockType}
                onToggleWatchlist={
                  onToggleWatchlist ? () => onToggleWatchlist(stock, stockType) : undefined
                }
              />
            );
          })}
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-7 w-full justify-start justify-items-stretch">
        {stocks.map((stock) => {
          const minQty = ("minimumPurchaseQuantity" in stock) ? (stock.minimumPurchaseQuantity ?? 1) : 1;
          const logo = stock.logoUrl || "";
          const change =
            stock.changePercent !== undefined && stock.changePercent !== null
              ? stock.changePercent
              : stock.change !== undefined && stock.change !== null
              ? stock.change
              : 0;
          return (
            <StockCard
              key={stock.id}
              logo={logo}
              name={stock.name}
              cin={stock.cin || ""}
              price={stock.price}
              change={change}
              marketCap={stock.marketCap || 0}
              minQty={minQty}
              stock={stock}
              onClick={() => onStockClick(stock)}
              isInWatchlist={watchlistedStockIds ? watchlistedStockIds.has(stock.id) : undefined}
              isTogglingWatchlist={togglingStockIds ? togglingStockIds.has(stock.id) : undefined}
              stockType={stockType}
              onToggleWatchlist={
                onToggleWatchlist
                  ? () => onToggleWatchlist(stock, stockType)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

