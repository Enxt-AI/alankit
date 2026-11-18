"use client";

import { useState, useMemo } from "react";
import { AlertCircle, IndianRupee, Percent, Sparkles, X } from "lucide-react";
import { useRmStocks } from "@/hooks/use-stocks";
import { useGenerateCoupon } from "@/hooks/use-coupons";

interface Stock {
  id: string;
  name: string;
  price: number;
  minimumPurchaseQuantity?: number | null;
  maximumPurchaseQuantity?: number | null;
  lendingPrice?: number | null;
}

export default function GenerateCouponPopup() {
  const { data: rawStocks = [], isLoading } = useRmStocks();
  const generateCouponMutation = useGenerateCoupon();
  const isGenerating = generateCouponMutation.isPending;

  const stocks: Stock[] = rawStocks.map((s: any) => ({
    id: s.id,
    name: s.name,
    price: s.sellingPrice ?? s.price ?? 0,
    minimumPurchaseQuantity: s.minimumPurchaseQuantity ?? s.minQuantity ?? 10,
    maximumPurchaseQuantity: s.maximumPurchaseQuantity,
    lendingPrice: s.lendingPrice,
  }));
  
  const [selectedStockId, setSelectedStockId] = useState("");
  const [minQuantity, setMinQuantity] = useState(10);
  const [maxQuantity, setMaxQuantity] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountPercentage, setDiscountPercentage] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  const selectedStock = stocks.find((s) => s.id === selectedStockId);

  const parsedDiscountAmount = parseFloat(discountAmount) || 0;
  const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;

  // Maximum allowed discount per share calculated safely without floating-point errors (e.g. 6.25 - 6.24 = 0.01)
  const maxAllowedDiscount = useMemo(() => {
    if (!selectedStock) return undefined;
    if (selectedStock.lendingPrice && selectedStock.lendingPrice > 0) {
      const raw = selectedStock.price - selectedStock.lendingPrice;
      return Math.max(0, Math.round(raw * 10000) / 10000);
    }
    return Math.max(0, Math.round((selectedStock.price - 0.0001) * 10000) / 10000);
  }, [selectedStock]);

  const maxAllowedPercentage = useMemo(() => {
    if (!selectedStock || selectedStock.price <= 0) return 100;
    if (selectedStock.lendingPrice && selectedStock.lendingPrice > 0) {
      const rawPct = ((selectedStock.price - selectedStock.lendingPrice) / selectedStock.price) * 100;
      return Math.max(0, Math.round(rawPct * 10000) / 10000);
    }
    return 99.99;
  }, [selectedStock]);

  const getEffectiveDiscount = (): number => {
    if (!selectedStock) return 0;
    if (discountType === "PERCENTAGE") {
      return (selectedStock.price * minQuantity) * (parsedDiscountPercentage / 100);
    }
    return parsedDiscountAmount * minQuantity;
  };

  const getEffectivePricePerShare = (): number => {
    if (!selectedStock) return 0;
    const totalVal = selectedStock.price * minQuantity;
    const discount = getEffectiveDiscount();
    return (totalVal - discount) / minQuantity;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedStock) {
      setErrorMsg("Please select a stock first.");
      return;
    }

    const minAllowed = selectedStock.minimumPurchaseQuantity || 1;
    if (minQuantity < minAllowed) {
      setErrorMsg(`Minimum quantity cannot be less than ${minAllowed} shares.`);
      return;
    }

    const parsedMaxQty = maxQuantity.trim() ? parseInt(maxQuantity, 10) : (selectedStock.maximumPurchaseQuantity || 999999);
    if (isNaN(parsedMaxQty) || parsedMaxQty < 1) {
      setErrorMsg("Please enter a valid maximum quantity.");
      return;
    }

    if (selectedStock.maximumPurchaseQuantity && parsedMaxQty > selectedStock.maximumPurchaseQuantity) {
      setErrorMsg(`Maximum quantity cannot exceed stock limit (${selectedStock.maximumPurchaseQuantity} shares).`);
      return;
    }

    if (minQuantity > parsedMaxQty) {
      setErrorMsg("Minimum quantity cannot be greater than maximum quantity.");
      return;
    }

    if (discountType === "FIXED") {
      if (parsedDiscountAmount <= 0) {
        setErrorMsg("Discount amount per share must be greater than 0.");
        return;
      }
      if (maxAllowedDiscount !== undefined && parsedDiscountAmount > maxAllowedDiscount + 0.00001) {
        setErrorMsg(`Discount per share cannot exceed ₹${maxAllowedDiscount} (lending floor limit).`);
        return;
      }
    } else {
      if (parsedDiscountPercentage <= 0 || parsedDiscountPercentage > 100) {
        setErrorMsg("Discount percentage must be between 0.01% and 100%.");
        return;
      }
      if (maxAllowedPercentage !== undefined && parsedDiscountPercentage > maxAllowedPercentage + 0.0001) {
        setErrorMsg(`Discount percentage cannot exceed ${maxAllowedPercentage}% (lending floor limit).`);
        return;
      }
    }

    const effPrice = getEffectivePricePerShare();
    if (selectedStock.lendingPrice && selectedStock.lendingPrice > 0 && (effPrice + 0.00001) < selectedStock.lendingPrice) {
      setErrorMsg(`Effective price per share (₹${effPrice.toFixed(2)}) cannot drop below the lending floor (₹${selectedStock.lendingPrice.toFixed(2)}).`);
      return;
    }

    try {
      const payload: Record<string, any> = {
        stockId: selectedStockId,
        minQuantity: minQuantity,
        maxQuantity: parsedMaxQty,
        discountType: discountType,
      };

      if (discountType === "FIXED") {
        payload.discountAmount = parsedDiscountAmount;
      } else {
        payload.discountAmount = 0;
        payload.discountPercentage = parsedDiscountPercentage;
      }

      await generateCouponMutation.mutateAsync(payload);

      // Notify parent window to refresh
      if (window.opener) {
        window.opener.postMessage('REFRESH_COUPONS', '*');
      }
      window.close();
    } catch (err: any) {
      setErrorMsg(Array.isArray(err.message) ? err.message.join(", ") : err.message || "Failed to generate referral code");
    }
  };

  const isGenerateDisabled = (): boolean => {
    const minAllowed = selectedStock ? (selectedStock.minimumPurchaseQuantity || 1) : 1;
    if (isGenerating || !selectedStockId || minQuantity < minAllowed) return true;
    if (discountType === "FIXED" && parsedDiscountAmount <= 0) return true;
    if (discountType === "PERCENTAGE" && (parsedDiscountPercentage <= 0 || parsedDiscountPercentage > 100)) return true;
    
    if (selectedStock) {
      const effPrice = getEffectivePricePerShare();
      if (effPrice <= 0) return true;
      if (selectedStock.lendingPrice && selectedStock.lendingPrice > 0 && (effPrice + 0.00001) < selectedStock.lendingPrice) return true;
    }
    
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading stock catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col p-4 sm:p-6 justify-center">
      <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 whitespace-nowrap">Generate Referral Code</h3>
            <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">Create a single-use client discount code</p>
          </div>
          <button 
            onClick={() => window.close()}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <form noValidate onSubmit={handleGenerate} className="px-6 py-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs flex items-start gap-2 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Select Stock */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
              Select Stock Name
            </label>
            <select 
              required
              value={selectedStockId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedStockId(id);
                const stock = stocks.find(s => s.id === id);
                if (stock) {
                  const newMin = stock.minimumPurchaseQuantity || 1;
                  setMinQuantity(newMin);
                  setErrorMsg("");
                }
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm text-slate-800"
            >
              <option value="">Choose an unlisted stock...</option>
              {stocks.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (Selling Price: ₹{s.price}{s.lendingPrice ? ` | Lending Floor: ₹${s.lendingPrice}` : ''})
                </option>
              ))}
            </select>
            {selectedStock && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Current Selling Price:</span>
                  <span className="font-mono font-semibold text-slate-900">₹{selectedStock.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Lending Price Floor:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {selectedStock.lendingPrice && selectedStock.lendingPrice > 0
                      ? `₹${selectedStock.lendingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Not Assigned'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                Min Quantity (Shares) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number"
                required
                min={selectedStock ? (selectedStock.minimumPurchaseQuantity || 1) : 1}
                value={minQuantity}
                onChange={(e) => setMinQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono text-slate-800"
              />
              {selectedStock && (selectedStock.minimumPurchaseQuantity || 1) > 1 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Stock min: {selectedStock.minimumPurchaseQuantity} shares
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                Max Quantity (Shares)
              </label>
              <input 
                type="number"
                min={minQuantity}
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                placeholder="No limit (999,999)"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono text-slate-800"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {maxQuantity.trim() && !isNaN(parseInt(maxQuantity, 10)) && parseInt(maxQuantity, 10) < 999999
                  ? `Capped at ${parseInt(maxQuantity, 10).toLocaleString('en-IN')} shares`
                  : "Leave empty for no limit"}
              </p>
            </div>
          </div>

          {/* Discount Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
              Discount Calculation Type
            </label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setDiscountType("FIXED")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  discountType === "FIXED"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                Discount per Share
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("PERCENTAGE")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  discountType === "PERCENTAGE"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                Percentage Discount
              </button>
            </div>
          </div>

          {/* Discount Input */}
          {discountType === "FIXED" ? (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 whitespace-nowrap ${!selectedStock ? 'text-slate-400' : 'text-slate-700'}`}>
                Discount per Share (INR)
              </label>
              <input 
                type="number"
                required
                disabled={!selectedStock}
                min="0.0001"
                step="any"
                max={maxAllowedDiscount !== undefined ? maxAllowedDiscount : undefined}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder={!selectedStock ? "Select a stock first" : "e.g. 0.01"}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <p className={`mt-1 text-[11px] ${!selectedStock ? 'text-slate-400' : 'text-slate-500'}`}>
                Supports decimal precision (e.g. ₹0.075 for sub-rupee discounts)
              </p>
            </div>
          ) : (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 whitespace-nowrap ${!selectedStock ? 'text-slate-400' : 'text-slate-700'}`}>
                Discount Percentage (%)
              </label>
              <input 
                type="number"
                required
                disabled={!selectedStock}
                min="0.0001"
                max={maxAllowedPercentage !== undefined ? maxAllowedPercentage : 100}
                step="any"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                placeholder={!selectedStock ? "Select a stock first" : "e.g. 5"}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          )}

          {/* Dynamic Summary Preview */}
          {selectedStock && (
            <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1.5 border-b border-slate-200">
                <span className="font-semibold uppercase tracking-wider text-slate-700">Effective Summary</span>
                <span className="text-[11px] text-slate-400 font-mono">{minQuantity} Shares</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Purchase Value:</span>
                <span className="font-mono font-medium text-slate-900">₹{(selectedStock.price * minQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Discount Offered:</span>
                <span className="font-mono font-medium text-emerald-600">- ₹{getEffectiveDiscount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold border-t border-slate-200 pt-2">
                <span className="text-slate-900">Effective Price per Share:</span>
                <span className={`font-mono ${
                  selectedStock.lendingPrice && (getEffectivePricePerShare() + 0.00001) < selectedStock.lendingPrice 
                    ? "text-rose-600" 
                    : "text-blue-600"
                }`}>
                  ₹{getEffectivePricePerShare().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              {selectedStock.lendingPrice && selectedStock.lendingPrice > 0 && (getEffectivePricePerShare() + 0.00001) < selectedStock.lendingPrice && (
                <div className="flex items-start gap-1.5 mt-2 text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Effective price cannot drop below lending price floor (₹{selectedStock.lendingPrice}).</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => window.close()}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerateDisabled()}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Generating Code...</span>
                </>
              ) : (
                "Generate Referral Code"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
