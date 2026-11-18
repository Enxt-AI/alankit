"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, IndianRupee, Layers, ArrowDownRight, Minus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DiscountSlab {
  minAmount: number;
  pricePerShare: number;
}

interface DiscountSlabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockName: string;
  initialSlabs: DiscountSlab[];
  onSave: (slabs: DiscountSlab[]) => void;
  basePrice: number;
}

const POPULAR_SLAB_AMOUNTS = [25000, 50000, 100000, 500000, 2500000];

function formatSlabLabel(amount: number) {
  if (amount >= 10000000) return `₹${amount / 10000000} Cr`;
  if (amount >= 100000) return `₹${amount / 100000} L`;
  if (amount >= 1000) return `₹${amount / 1000} K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function DiscountSlabsDialog({
  open,
  onOpenChange,
  stockName,
  initialSlabs,
  onSave,
  basePrice,
}: DiscountSlabsDialogProps) {
  const [slabs, setSlabs] = useState<DiscountSlab[]>([]);

  useEffect(() => {
    if (open) {
      const sorted = [...(initialSlabs || [])].sort((a, b) => a.minAmount - b.minAmount);
      setSlabs(sorted);
    }
  }, [open, initialSlabs]);

  const handleAddSlab = (minAmount = 0) => {
    setSlabs((prev) => [...prev, { minAmount, pricePerShare: basePrice }]);
  };

  const handleRemoveSlab = (index: number) => {
    setSlabs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof DiscountSlab, value: number) => {
    setSlabs((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        [field]: value,
      };
      return next;
    });
  };

  const handleStepPrice = (index: number, delta: number, e: React.MouseEvent) => {
    const current = slabs[index];
    if (!current) return;
    const mult = e.shiftKey ? 10 : 1;
    let step = 1;
    if (current.pricePerShare < 5) step = 0.5;
    step *= mult;

    let nextPrice = Math.round((current.pricePerShare + delta * step) * 100) / 100;
    if (nextPrice <= 0) nextPrice = 0.01;
    if (nextPrice > basePrice) nextPrice = basePrice;
    handleChange(index, "pricePerShare", nextPrice);
  };

  const handleSave = () => {
    const validSlabs = slabs.filter((s) => s.minAmount > 0 && s.pricePerShare > 0);
    validSlabs.sort((a, b) => a.minAmount - b.minAmount);
    onSave(validSlabs);
    onOpenChange(false);
  };

  const existingAmounts = new Set(slabs.map((s) => s.minAmount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-xl p-0 gap-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#FAFBFC]">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#ECFDF5] border border-[#16A34A]/20 flex items-center justify-center text-[#16A34A] shrink-0 mt-0.5">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-[#0F172A] tracking-tight leading-tight">
                Discount Slabs
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-[#475569] truncate max-w-[280px]" title={stockName}>
                  {stockName}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20 font-mono">
                  Base Price: ₹{basePrice.toLocaleString("en-IN")}
                </span>
              </div>
              <DialogDescription className="text-xs text-[#64748B] mt-1.5">
                Configure quantity or investment tier pricing. Investors reaching the minimum investment threshold receive the discounted rate.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[62vh] overflow-y-auto">
          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
              <Sparkles className="h-3 w-3 text-[#16A34A]" />
              <span>Quick add volume slabs:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SLAB_AMOUNTS.map((amt) => {
                const isAdded = existingAmounts.has(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={isAdded}
                    onClick={() => handleAddSlab(amt)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer select-none",
                      isAdded
                        ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed opacity-60"
                        : "bg-white hover:bg-[#ECFDF5] hover:text-[#16A34A] hover:border-[#16A34A]/40 text-[#334155] border border-neutral-200 shadow-2xs active:scale-95"
                    )}
                  >
                    + {formatSlabLabel(amt)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slabs List */}
          {slabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                <Layers className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-[#0F172A]">No discount slabs configured</p>
              <p className="text-xs text-[#64748B] max-w-xs mt-1">
                Investors will always purchase at the base price of <span className="font-semibold text-slate-800">₹{basePrice}</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {slabs.map((slab, idx) => {
                const discountPct =
                  basePrice > 0 && slab.pricePerShare < basePrice
                    ? (((basePrice - slab.pricePerShare) / basePrice) * 100).toFixed(1)
                    : null;
                const savingsPerShare =
                  basePrice > slab.pricePerShare
                    ? (basePrice - slab.pricePerShare).toFixed(2)
                    : null;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs hover:border-[#CBD5E1] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Slab #{idx + 1}
                      </span>
                      {discountPct ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] bg-[#ECFDF5] border border-[#16A34A]/30 px-2 py-0.5 rounded-md font-mono">
                          <ArrowDownRight className="h-3 w-3" />
                          {discountPct}% OFF (Save ₹{savingsPerShare}/sh)
                        </span>
                      ) : slab.pricePerShare > basePrice ? (
                        <span className="text-[11px] font-semibold text-rose-600">
                          Exceeds base price (₹{basePrice})
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">
                          Base price rate
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Min Amount */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-[#64748B] font-semibold">
                          Min Purchase Amount (₹)
                        </Label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-xs font-mono text-slate-400 select-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min={1}
                            step={1000}
                            value={slab.minAmount || ""}
                            onChange={(e) =>
                              handleChange(idx, "minAmount", parseFloat(e.target.value) || 0)
                            }
                            className="pl-6 h-9 font-mono text-xs font-bold rounded-lg border-[#CBD5E1] focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="e.g. 100000"
                          />
                        </div>
                      </div>

                      {/* Discounted Price with - / + Stepper */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-[#64748B] font-semibold">
                          Discounted Price / Share (₹)
                        </Label>
                        <div className="flex items-center h-9 w-full rounded-lg border border-[#CBD5E1] bg-white transition-all overflow-hidden focus-within:border-[#16A34A] focus-within:ring-2 focus-within:ring-[#16A34A]/20">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => handleStepPrice(idx, -1, e)}
                            disabled={slab.pricePerShare <= 0.01}
                            className="h-full w-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-r border-neutral-200"
                            title="Decrease (Hold Shift for 10x)"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <div className="relative flex-1 min-w-0 flex items-center justify-center px-1">
                            <span className="text-[11px] font-mono text-slate-400 select-none shrink-0 mr-0.5">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="any"
                              value={slab.pricePerShare || ""}
                              onChange={(e) =>
                                handleChange(idx, "pricePerShare", parseFloat(e.target.value) || 0)
                              }
                              className="w-full h-full bg-transparent text-center font-mono text-xs font-bold text-slate-800 focus:outline-none placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => handleStepPrice(idx, 1, e)}
                            disabled={slab.pricePerShare >= basePrice}
                            className="h-full w-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-l border-neutral-200"
                            title="Increase (Hold Shift for 10x)"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="pt-5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSlab(idx)}
                          className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove slab"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Slab Button */}
          <button
            type="button"
            onClick={() => handleAddSlab(0)}
            className="w-full h-10 border border-dashed border-[#16A34A]/50 bg-[#ECFDF5]/40 hover:bg-[#ECFDF5] text-[#16A34A] rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.99]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Custom Discount Slab
          </button>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFBFC] flex items-center justify-between sm:justify-between">
          <span className="text-xs font-semibold text-[#64748B]">
            {slabs.length} {slabs.length === 1 ? "slab" : "slabs"} configured
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl border-[#CBD5E1] text-[#475569] hover:bg-neutral-100 font-semibold text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="h-9 px-5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
            >
              Save Slabs
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
