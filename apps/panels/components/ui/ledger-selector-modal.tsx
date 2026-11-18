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
import type { Ledger } from "@/lib/accounting-api";

interface LedgerSelectorModalProps {
  ledgers: Ledger[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export function LedgerSelectorModal({
  ledgers,
  value,
  onChange,
  disabled = false,
}: LedgerSelectorModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Find currently selected ledger
  const selectedLedger = React.useMemo(() => {
    return ledgers.find((l) => l.id === value);
  }, [ledgers, value]);

  // Filter ledgers based on search
  const filteredLedgers = React.useMemo(() => {
    const nonStockLedgers = ledgers.filter((l) => l.type !== "STOCK");
    if (!searchQuery.trim()) return nonStockLedgers;
    const query = searchQuery.toLowerCase().trim();
    return nonStockLedgers.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.code?.toLowerCase().includes(query) ||
        l.sunCode?.toLowerCase().includes(query)
    );
  }, [ledgers, searchQuery]);

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
      setSelectedIndex((prev) => (prev < filteredLedgers.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredLedgers[selectedIndex]) {
        handleSelect(filteredLedgers[selectedIndex].id);
      }
    }
  };

  const handleSelect = (ledgerId: string) => {
    onChange(ledgerId);
    setIsOpen(false);
  };

  const getLedgerIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case "USER":
        return <User className="h-4 w-4 text-violet-500" />;
      case "SALE":
      case "PURCHASE":
        return <ShoppingCart className="h-4 w-4 text-amber-500" />;
      default:
        return <ArrowLeftRight className="h-4 w-4 text-slate-500" />;
    }
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
          {selectedLedger ? (
            <div className="flex flex-col items-start truncate text-left w-full mr-2">
              <span className="font-bold text-slate-800 truncate block w-full">{selectedLedger.name}</span>
            </div>
          ) : (
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Select Account
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

        <div className="max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50">
          {filteredLedgers.length > 0 ? (
            <div className="p-2">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[9px] select-none">
                    <th className="pb-2 pl-3 font-semibold">Ledger Name</th>
                    <th className="pb-2 pl-2 font-semibold">Code</th>
                    <th className="pb-2 pl-2 font-semibold hidden sm:table-cell">Group Name</th>
                    <th className="pb-2 pl-2 font-semibold hidden sm:table-cell">Group Code</th>
                    <th className="pb-2 pl-2 font-semibold hidden sm:table-cell">Sun Code</th>
                    <th className="pb-2 pl-2 font-semibold hidden md:table-cell">Sun Name</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedgers.map((ledger, idx) => {
                    const isSelected = ledger.id === value;
                    const isHighlighted = idx === selectedIndex;
                    const balance = ledger.currentBalance || 0;

                    return (
                      <tr
                        key={ledger.id}
                        onClick={() => handleSelect(ledger.id)}
                        className={cn(
                          "cursor-pointer transition-all duration-150 group",
                          isHighlighted 
                            ? "bg-emerald-50/70 shadow-sm border-y border-emerald-100 font-semibold" 
                            : "hover:bg-white hover:shadow-sm"
                        )}
                      >
                        {/* Ledger Name (Icon + Name) */}
                        <td className="py-2.5 pl-3 max-w-[280px] truncate">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-7 w-7 rounded-none flex items-center justify-center shrink-0 border border-slate-100 transition-colors",
                              isHighlighted ? "bg-emerald-100/50 text-emerald-600 border-emerald-200" : "bg-slate-100 group-hover:bg-slate-50"
                            )}>
                              {getLedgerIcon(ledger.type)}
                            </div>
                            <span className="font-bold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors truncate">
                              {ledger.name}
                            </span>
                          </div>
                        </td>



                        {/* Code */}
                        <td className="py-2.5 pl-2">
                          {ledger.code ? (
                            <span className="text-[10px] font-mono text-slate-700 font-bold">
                              {ledger.code}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-300">-</span>
                          )}
                        </td>

                        {/* Group Name */}
                        <td className="py-2.5 pl-2 hidden sm:table-cell max-w-[140px] truncate">
                          {ledger.group?.name ? (
                            <span className="text-slate-600 text-xs font-semibold truncate block">
                              {ledger.group.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>

                        {/* Group Code */}
                        <td className="py-2.5 pl-2 hidden sm:table-cell">
                          {ledger.group?.code ? (
                            <span className="text-[10px] font-mono text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 border border-amber-100">
                              {ledger.group.code}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-300">-</span>
                          )}
                        </td>

                        {/* Sun Code (Separate Column) */}
                        <td className="py-2.5 pl-2 hidden sm:table-cell">
                          {ledger.sunCode ? (
                            <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 border border-emerald-100">
                              {ledger.sunCode}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-300">-</span>
                          )}
                        </td>

                        {/* Sun Name (Separate Column) */}
                        <td className="py-2.5 pl-2 hidden md:table-cell max-w-[140px] truncate">
                          {ledger.sunName ? (
                            <span className="text-slate-600 text-xs font-semibold truncate block">
                              {ledger.sunName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td className="py-2.5 pr-3 text-right">
                          <div className="flex flex-col items-end shrink-0">
                            <span className={cn(
                              "text-xs font-mono font-bold",
                              balance >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {balance < 0 ? "-" : ""}₹{fmt(Math.abs(balance))}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                              {balance >= 0 ? "Dr" : "Cr"}
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
              <h3 className="text-sm font-bold text-slate-700">No ledgers found</h3>
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
