"use client";

import * as React from "react";
import { Search, ChevronDown, Check, Building2, User, ShoppingCart, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Stock } from "@/types/stock";
import { getAllStocks } from "@/lib/stocks-api";

interface StockSelectorModalProps {
  value: string; // The selected ISIN or ID
  onChange: (value: string, name: string, price?: number) => void;
  disabled?: boolean;
  disableZeroQty?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export function StockSelectorModal({
  value,
  onChange,
  disabled = false,
  disableZeroQty = false,
}: StockSelectorModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [stocks, setStocks] = React.useState<Stock[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && stocks.length === 0) {
      setIsLoading(true);
      getAllStocks()
        .then((res) => setStocks(res || []))
        .catch(() => setStocks([]))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, stocks.length]);

  // Find currently selected stock
  const selectedStock = React.useMemo(() => {
    return stocks.find((s) => s.isin === value || s.id === value) || (value ? { name: value, isin: value } as Stock : undefined);
  }, [stocks, value]);

  // Filter stocks based on search
  const filteredStocks = React.useMemo(() => {
    if (!searchQuery.trim()) return stocks;
    const query = searchQuery.toLowerCase().trim();
    return stocks.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.isin?.toLowerCase().includes(query) ||
        s.cin?.toLowerCase().includes(query)
    );
  }, [stocks, searchQuery]);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      // Slight delay to allow modal animation to finish before focusing
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredStocks.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredStocks[selectedIndex];
      const isOutOfStock = disableZeroQty && (selected?.stockQuantity == null || selected?.stockQuantity <= 0);
      if (selected && !isOutOfStock) {
        handleSelect(selected);
      }
    }
  };

  const handleSelect = (stock: Stock) => {
    onChange(stock.isin || stock.id, stock.name, stock.price);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-none border border-slate-200 bg-white px-3 py-1.5 text-xs transition-all duration-200 outline-none hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100",
            disabled && "cursor-not-allowed opacity-50 bg-slate-50"
          )}
        >
          {selectedStock ? (
            <div className="flex flex-col items-start truncate text-left w-full mr-2">
              <span className="font-bold text-slate-800 truncate block w-full">{selectedStock.name}</span>
            </div>
          ) : (
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Select Stock
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden bg-white rounded-none border-slate-200 shadow-2xl">
        <div className="bg-white p-4 border-b border-slate-100 shadow-sm z-10 relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, code, or Sun Code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0); // Reset selection when filtering
              }}
              onKeyDown={handleKeyDown}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-none outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100/50 transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2 bg-slate-50">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredStocks.length > 0 ? (
            <div className="p-2">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[9px] select-none">
                    <th className="pb-2 pl-3 font-semibold">Stock Name</th>
                    <th className="pb-2 pl-2 font-semibold">Type</th>
                    <th className="pb-2 pl-2 font-semibold">ISIN</th>
                    <th className="pb-2 pl-2 font-semibold hidden sm:table-cell">CIN</th>
                    <th className="pb-2 pl-2 font-semibold text-right">Available Qty</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStocks.map((stock, idx) => {
                    const isSelected = stock.isin === value || stock.id === value;
                    const isHighlighted = idx === selectedIndex;
                    const price = stock.price || 0;
                    const isOutOfStock = disableZeroQty && (stock.stockQuantity == null || stock.stockQuantity <= 0);

                    return (
                      <tr
                        key={stock.id}
                        onClick={() => {
                          if (isOutOfStock) return;
                          handleSelect(stock);
                        }}
                        className={cn(
                          "transition-all duration-150 group",
                          isOutOfStock
                            ? "bg-slate-50 opacity-60 cursor-not-allowed select-none"
                            : isHighlighted 
                            ? "bg-emerald-50/70 shadow-sm border-y border-emerald-100 font-semibold cursor-pointer" 
                            : "hover:bg-white hover:shadow-sm cursor-pointer"
                        )}
                      >
                        {/* Stock Name (Icon + Name) */}
                        <td className="py-2.5 pl-3 max-w-[280px] truncate">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-7 w-7 rounded-none flex items-center justify-center shrink-0 border border-slate-100 transition-colors",
                              isHighlighted && !isOutOfStock ? "bg-emerald-100/50 text-emerald-600 border-emerald-200" : "bg-slate-100 group-hover:bg-slate-50"
                            )}>
                              <Building2 className="h-4 w-4 text-slate-500" />
                            </div>
                            <span className={cn(
                              "font-bold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors truncate",
                              isOutOfStock && "text-slate-400 group-hover:text-slate-400"
                            )}>
                              {stock.name}
                            </span>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-2.5 pl-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-none">
                            STOCK
                          </span>
                        </td>

                        {/* ISIN */}
                        <td className="py-2.5 pl-2">
                          {stock.isin ? (
                            <span className="text-[10px] font-mono text-slate-700 font-bold">
                              {stock.isin}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-300">-</span>
                          )}
                        </td>

                        {/* CIN */}
                        <td className="py-2.5 pl-2 hidden sm:table-cell">
                          {stock.cin ? (
                            <span className="text-[10px] font-mono text-slate-700 font-semibold">
                              {stock.cin}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-300">-</span>
                          )}
                        </td>

                        {/* Available Qty */}
                        <td className="py-2.5 pl-2 text-right">
                          {isOutOfStock ? (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 border border-rose-100">
                              0 Qty / Out of Stock
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-bold text-slate-700">
                              {stock.stockQuantity ?? 0}
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-2.5 pr-3 text-right">
                          <div className="flex flex-col items-end shrink-0">
                            <span className={cn(
                              "text-xs font-mono font-bold text-emerald-600",
                              isOutOfStock && "text-slate-400"
                            )}>
                              ₹{fmt(price)}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                              Price
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-none bg-slate-100 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No stocks found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Try searching for a different name, code, or Sun Code.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
