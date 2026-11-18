"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, ArrowUp, ArrowDown, Clock, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StockCategory } from "@/lib/stocks-api";

type SortType = "NONE" | "ALPHA" | "MARKET_CAP";
type SortOrder = "ASC" | "DESC";
type StockTab = "Latest" | "Popular" | "Upcoming";

interface StockFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalResults: number;
  activeTab: StockTab;
  onActiveTabChange: (tab: StockTab) => void;
  maxPrice: number;
  onMaxPriceChange: (price: number) => void;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sortType: SortType;
  sortOrder: SortOrder;
  onSortTypeChange: (type: SortType) => void;
  onSortOrderChange: (order: SortOrder) => void;
  tabs?: StockTab[];
  categories: StockCategory[];
  categoriesLoading?: boolean;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
}

export function StockFilters({
  searchQuery, onSearchChange, totalResults, activeTab, onActiveTabChange,
  maxPrice, onMaxPriceChange, sliderMin = 0, sliderMax = 500000, sliderStep = 1000,
  sortType, sortOrder, onSortTypeChange, onSortOrderChange,
  tabs = ["Latest", "Popular", "Upcoming"], categories, categoriesLoading,
  selectedCategoryId, onCategoryChange,
}: StockFiltersProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, onSearchChange]);
  useEffect(() => setInputValue(searchQuery), [searchQuery]);

  const toggleSort = (type: SortType) => {
    if (sortType === type) onSortOrderChange(sortOrder === "ASC" ? "DESC" : "ASC");
    else { onSortTypeChange(type); onSortOrderChange("ASC"); }
  };

  return (
    <>
      <aside className="h-fit w-full shrink-0 rounded-2xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-24 lg:w-[280px]">
        <div className="mb-5 flex items-center gap-2 border-b border-neutral-100 pb-4 font-semibold text-neutral-900">
          <SlidersHorizontal className="h-4 w-4 text-[#16A34A]" /> Filters <span className="ml-auto text-xs font-normal text-neutral-400">{totalResults} results</span>
        </div>
        <section className="mb-5 border-b border-neutral-100 pb-5">
          <label className="mb-2 block text-sm font-medium text-neutral-700" htmlFor="stock-search">Search Stock</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input id="stock-search" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Symbol or company..." className="h-11 rounded-xl pl-9 focus-visible:ring-[#16A34A] focus-visible:ring-offset-white" />
          </div>
        </section>
        <section className="mb-5 border-b border-neutral-100 pb-5">
          <div className="mb-4 flex items-center justify-between gap-2 text-sm font-medium text-neutral-700">
            <span>Price Range</span><span className="whitespace-nowrap text-[#16A34A]">Up to ₹{maxPrice.toLocaleString("en-IN")}</span>
          </div>
          <Slider min={sliderMin} max={sliderMax} step={sliderStep} value={[maxPrice]} onValueChange={(v) => onMaxPriceChange(v[0] ?? sliderMin)} />
          <div className="mt-2 flex justify-between text-xs text-neutral-400"><span>₹{sliderMin.toLocaleString("en-IN")}</span><span>₹{sliderMax.toLocaleString("en-IN")}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[500, 1500, 3000].map((price) => <button key={price} onClick={() => onMaxPriceChange(Math.min(price, sliderMax))} className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200">Under ₹{price.toLocaleString("en-IN")}</button>)}
            <button onClick={() => onMaxPriceChange(sliderMax)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">All</button>
          </div>
        </section>
        <section className="mb-5 border-b border-neutral-100 pb-5">
          <p className="mb-2 text-sm font-medium text-neutral-700">Market Trend</p>
          <div className="grid grid-cols-2 gap-2">
            {tabs.map((tab) => {
              const Icon = tab === "Upcoming" ? Calendar : Clock;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onActiveTabChange(tab)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    activeTab === tab
                      ? "border-[#16A34A] bg-[#16A34A] text-white"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab}
                </button>
              );
            })}
          </div>
        </section>
        <section className="mb-5 border-b border-neutral-100 pb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Sector</p>
            {selectedCategoryId && (
              <button
                type="button"
                onClick={() => onCategoryChange("")}
                className="text-xs font-medium text-[#16A34A] hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onCategoryChange("")}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                !selectedCategoryId
                  ? "bg-emerald-50 font-medium text-emerald-700"
                  : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              <span>All Sectors</span>
              {!selectedCategoryId && <span className="h-2 w-2 rounded-full bg-[#16A34A]" />}
            </button>
            {categoriesLoading ? (
              <p className="px-3 py-2 text-xs text-neutral-400">Loading sectors…</p>
            ) : categories.length === 0 ? (
              <p className="px-3 py-2 text-xs text-neutral-400">No sectors available</p>
            ) : (
              categories.map((category) => {
                const isSelected =
                  selectedCategoryId === category.id ||
                  selectedCategoryId.toLowerCase() === category.name.toLowerCase();
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => onCategoryChange(isSelected ? "" : category.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-emerald-50 font-medium text-emerald-700"
                        : "text-neutral-600 hover:bg-neutral-50"
                    )}
                  >
                    <span className="truncate pr-2">{category.name}</span>
                    <span
                      className={cn(
                        "text-xs shrink-0",
                        isSelected ? "text-emerald-700 font-medium" : "text-neutral-400"
                      )}
                    >
                      {category.stockCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
        <section>
          <p className="mb-2 text-sm font-medium text-neutral-700">Sort By</p>
          <div className="grid grid-cols-2 gap-2">
            {([ ["ALPHA", "Alphabet"], ["MARKET_CAP", "Market Cap"] ] as const).map(([type, label]) => <Button key={type} variant="outline" size="sm" onClick={() => toggleSort(type)} className={cn("h-9 justify-between text-xs", sortType === type && "border-[#16A34A] text-[#16A34A]")}>{label}{sortType === type && (sortOrder === "ASC" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</Button>)}
          </div>
        </section>
      </aside>
    </>
  );
}
