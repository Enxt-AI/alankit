"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ArrowUpRight, Package } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStocks } from "@/hooks/use-stocks";
import { useBaskets } from "@/hooks/use-baskets";
import { formatCurrencyINR, getStockSlug } from "@/lib/utils";

interface MobileSearchOverlayProps {
  onClose: () => void;
  onNavigate: () => void;
}

export function MobileSearchOverlay({ onClose, onNavigate }: MobileSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [recentStockIds, setRecentStockIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"Recent" | "Popular">("Popular");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("recent_stock_ids");
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          setRecentStockIds(ids);
          if (ids.length > 0) setActiveTab("Recent");
        }
      }
    } catch {
      // Recent searches are optional when browser storage is unavailable.
    }
  }, []);

  const handleStockClick = (stockId: string) => {
    try {
      const stored = localStorage.getItem("recent_stock_ids");
      let recent: string[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(recent)) recent = [];
      recent = recent.filter((id) => id !== stockId);
      recent.unshift(stockId);
      recent = recent.slice(0, 5);
      localStorage.setItem("recent_stock_ids", JSON.stringify(recent));
    } catch {
      // Navigation remains available when browser storage is unavailable.
    }
    onNavigate();
  };

  const { data: stocks = [], isLoading: isLoadingStocks } = useStocks();
  const { data: baskets = [], isLoading: isLoadingBaskets } = useBaskets();

  const filteredStocks = useMemo(() => {
    if (!query.trim()) {
      if (activeTab === "Recent") {
        return recentStockIds
          .map((id) => stocks.find((s) => s.id === id))
          .filter(Boolean) as typeof stocks;
      }
      if (activeTab === "Popular") {
        const popular = stocks.filter((s) => s.tags && s.tags.some(t => t.toLowerCase().includes("popular")));
        return popular.length > 0 ? popular.slice(0, 5) : stocks.slice(4, 9);
      }
      return stocks.slice(0, 5);
    }
    const lowercaseQuery = query.toLowerCase();
    return stocks.filter(
      (s) =>
        s.name.toLowerCase().includes(lowercaseQuery) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(lowercaseQuery)))
    ).slice(0, 10);
  }, [stocks, query, activeTab, recentStockIds]);

  const filteredBaskets = useMemo(() => {
    if (!query.trim()) return [];
    const lowercaseQuery = query.toLowerCase();
    return baskets.filter(
      (b) =>
        b.name.toLowerCase().includes(lowercaseQuery) ||
        b.category.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 3);
  }, [baskets, query]);

  const isLoading = isLoadingStocks || isLoadingBaskets;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="min-h-0 flex-1 bg-white flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col pt-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 pb-2">
          <div className="min-w-0 flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              aria-label="Search stocks and baskets"
              placeholder="Search stocks, baskets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-50 rounded-lg pl-10 pr-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[#117f41]/20 transition-all border border-gray-200 focus:border-[#117f41]"
            />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[15px] font-medium text-[#117f41] hover:text-[#0c5a2e]"
          >
            Cancel
          </button>
        </div>

        {/* Tabs - only show when no query */}
        {!query && (
          <div className="flex px-4 pt-2">
            {(["Recent", "Popular"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 pb-3 text-[14px] font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab
                    ? "border-[#117f41] text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-6 h-6 border-2 border-[#117f41] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {/* Baskets Results */}
            {filteredBaskets.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 ml-1">
                  Baskets
                </h3>
                <div className="space-y-2">
                  {filteredBaskets.map((basket) => (
                    <Link
                      key={basket.id}
                      href={`/baskets/${basket.id}`}
                      onClick={onNavigate}
                      className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-[#117f41]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                          {basket.name}
                        </h4>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {basket.category}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Stocks Results */}
            {filteredStocks.length > 0 ? (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 ml-1">
                  {query ? "Stocks" : activeTab === "Recent" ? "Previous searches" : `${activeTab} Stocks`}
                </h3>
                <div className="space-y-2">
                  {filteredStocks.map((stock) => (
                    <Link
                      key={stock.id}
                      href={`/stocks/${getStockSlug(stock)}`}
                      onClick={() => handleStockClick(stock.id)}
                      className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <Avatar className="w-12 h-12 rounded-xl shrink-0 border border-gray-100 p-1">
                        <AvatarImage src={stock.logoUrl || ""} className="object-contain" />
                        <AvatarFallback className="bg-gray-50 text-[#117f41] font-bold text-sm">
                          {stock.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                          {stock.name}
                        </h4>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {formatCurrencyINR(stock.price)}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              !isLoading && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No results found for &quot;{query}&quot;</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
