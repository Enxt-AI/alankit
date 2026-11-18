"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { z } from "zod";
import {
  IndianRupee,
  Search,
  Loader2,
  AlertCircle,
  Package,
  ArrowUpDown,
  CircleDot,
  Check,
  X,
  Layers,
  Save,
  Download,
  Upload,
  RotateCcw,
  Minus,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/components/ui/floating-notification";
import { getAllStocksOperation, updateStockOperation } from "@/lib/stocks-api";
import { DiscountSlabsDialog, DiscountSlab } from "@/components/operation/stock-pricing/discount-slabs-dialog";
import { useAuthStore } from "@/store/auth-store";

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  sno: 75,
  stockName: 230,
  isinCin: 150,
  basePrice: 140,
  internalLending: 140,
  externalLending: 140,
  backupQuantity: 120,
  slabs: 110,
  status: 110,
  actions: 100,
};

const STORAGE_KEY = 'operation_stock_pricing_col_widths_v3';

const COLUMNS_CONFIG = [
  { key: 'sno', label: 'S.No', align: 'left' as const, sortable: false },
  { key: 'stockName', label: 'Stock Name', align: 'left' as const, sortable: true, sortKey: 'name' as const },
  { key: 'isinCin', label: 'ISIN / CIN', align: 'left' as const, sortable: false },
  { key: 'basePrice', label: 'Base Price (₹)', align: 'left' as const, sortable: true, sortKey: 'price' as const },
  { key: 'internalLending', label: 'Internal Lending (₹)', align: 'left' as const, sortable: false },
  { key: 'externalLending', label: 'External Lending (₹)', align: 'left' as const, sortable: false },
  { key: 'backupQuantity', label: 'Backup Qty', align: 'left' as const, sortable: true, sortKey: 'backupQuantity' as const },
  { key: 'slabs', label: 'Slabs', align: 'center' as const, sortable: false },
  { key: 'status', label: 'Status', align: 'center' as const, sortable: true, sortKey: 'isActive' as const },
  { key: 'actions', label: 'Actions', align: 'right' as const, sortable: false },
];

interface StockRow {
  id: string;
  name: string;
  isin?: string | null;
  cin: string;
  price: number;
  isActive: boolean;
  discountSlabs?: DiscountSlab[] | null;
  internalLendingPrice?: number | null;
  externalLendingPrice?: number | null;
  backupQuantity?: number;
  originalPrice: number;
  originalIsActive: boolean;
  originalDiscountSlabs?: DiscountSlab[] | null;
  originalInternalLendingPrice?: number | null;
  originalExternalLendingPrice?: number | null;
  originalBackupQuantity?: number;
  isModified: boolean;
  isSaving: boolean;
}

const STANDARD_SLAB_AMOUNTS = [25000, 50000, 100000, 500000, 2500000, 5000000, 10000000];

function parseSlabHeader(headerStr: string): number | null {
  if (!headerStr) return null;
  const clean = headerStr.trim().toLowerCase();
  
  if (
    clean.includes("stock name") || 
    clean.includes("base price") || 
    clean.includes("internal") || 
    clean.includes("external") || 
    clean.includes("count") || 
    clean.includes("status") ||
    clean.includes("custom slabs") ||
    clean === "isin" ||
    clean === "cin"
  ) {
    return null;
  }

  if (clean.includes("1,00,00,000") || clean.includes("10000000") || clean.includes("1cr") || clean.includes("1 crore")) return 10000000;
  if (clean.includes("50,00,000") || clean.includes("5000000") || clean.includes("50l") || clean.includes("50 lakh")) return 5000000;
  if (clean.includes("25,00,000") || clean.includes("2500000") || clean.includes("25l") || clean.includes("25 lakh")) return 2500000;
  if (clean.includes("5,00,000") || clean.includes("500000") || clean.includes("5l") || clean.includes("5 lakh")) return 500000;
  if (clean.includes("1,00,000") || clean.includes("100000") || clean.includes("1l") || clean.includes("1 lakh")) return 100000;
  if (clean.includes("50,000") || clean.includes("50000") || clean.includes("50k")) return 50000;
  if (clean.includes("25,00,000") || clean.includes("25,000") || clean.includes("25000") || clean.includes("25k")) {
    if (clean.includes("25,00,000") || clean.includes("2500000") || clean.includes("25l")) return 2500000;
    return 25000;
  }

  const digitsOnly = clean.replace(/[^0-9]/g, "");
  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
}

const stockPricingSchema = z.object({
  price: z.number().min(0, "Base price must be greater than or equal to 0"),
  internalLendingPrice: z.number().nullable().optional(),
  externalLendingPrice: z.number().nullable().optional(),
}).refine(data => {
  if (data.internalLendingPrice != null) {
    if (data.internalLendingPrice < 0 || data.internalLendingPrice > data.price) {
      return false;
    }
  }
  return true;
}, {
  message: "Internal Lending Price must be between 0 and the Base Price",
  path: ["internalLendingPrice"],
}).refine(data => {
  if (data.externalLendingPrice != null) {
    if (data.externalLendingPrice < 0 || data.externalLendingPrice > data.price) {
      return false;
    }
  }
  return true;
}, {
  message: "External Lending Price must be between 0 and the Base Price",
  path: ["externalLendingPrice"],
});

type SortField = "name" | "price" | "backupQuantity" | "isActive";
type SortDir = "asc" | "desc";

interface PriceStepperProps {
  value: number | null | undefined;
  originalValue: number | null | undefined;
  onChange: (valStr: string) => void;
  disabled?: boolean;
  allowNull?: boolean;
  placeholder?: string;
  max?: number;
}

function PriceStepper({
  value,
  originalValue,
  onChange,
  disabled = false,
  allowNull = false,
  placeholder,
  max,
}: PriceStepperProps) {
  const isModified = value !== originalValue;

  const handleStep = (delta: number, e: React.MouseEvent) => {
    if (disabled) return;
    const multiplier = e.shiftKey ? 10 : 1;
    if (value == null || isNaN(value)) {
      if (delta > 0) {
        const initial = max != null && max < 1 ? max : 1;
        onChange(String(initial));
      }
      return;
    }
    let step = 1;
    if (value < 5) step = 0.5;
    step *= multiplier;

    let nextVal = Math.round((value + delta * step) * 100) / 100;
    if (nextVal <= 0) {
      if (allowNull) {
        onChange("");
        return;
      }
      nextVal = 0.01;
    }
    if (max != null && nextVal > max) {
      nextVal = max;
    }
    onChange(String(nextVal));
  };

  const isDecreaseDisabled =
    disabled ||
    (!allowNull && value != null && value <= 0.01) ||
    (allowNull && (value == null || value <= 0));

  const isIncreaseDisabled =
    disabled || (max != null && value != null && value >= max);

  const showCurrencyPrefix = (value != null && value !== 0) || !placeholder;

  return (
    <div
      className={cn(
        "flex items-center h-8 w-full rounded-md border bg-white transition-all shadow-2xs overflow-hidden",
        isModified
          ? "border-amber-400 bg-amber-50/40 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500"
          : "border-neutral-200 hover:border-neutral-300 focus-within:border-[#16A34A] focus-within:ring-1 focus-within:ring-[#16A34A]/25"
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => handleStep(-1, e)}
        disabled={isDecreaseDisabled}
        className={cn(
          "h-full w-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-r",
          isModified ? "border-amber-300/80" : "border-neutral-200"
        )}
        title="Decrease (Hold Shift for 10x)"
      >
        <Minus className="h-3 w-3" />
      </button>
      <div className="relative flex-1 min-w-0 flex items-center justify-center px-1">
        {showCurrencyPrefix && (
          <span className="text-[11px] font-mono text-slate-400 select-none shrink-0 mr-0.5">
            ₹
          </span>
        )}
        <input
          type="number"
          step="any"
          disabled={disabled}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full bg-transparent text-center font-mono text-xs font-bold text-slate-800 focus:outline-none placeholder:text-slate-400 placeholder:font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => handleStep(1, e)}
        disabled={isIncreaseDisabled}
        className={cn(
          "h-full w-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-l",
          isModified ? "border-amber-300/80" : "border-neutral-200"
        )}
        title="Increase (Hold Shift for 10x)"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function StockPricingPage() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasManageStocks = operationAdmin?.permissions?.includes('manage_stocks') || isSuperAdmin;

  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column resizing state (Excel-style)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
        }
      } catch (e) {}
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const saveWidths = (widths: Record<string, number>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {}
  };

  const resetAllColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify.success('Column widths reset to default');
  };

  const resetColumnWidth = (key: string) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, [key]: DEFAULT_COLUMN_WIDTHS[key] || 120 };
      saveWidths(updated);
      return updated;
    });
  };

  const resizingColRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const startResizing = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120;
    resizingColRef.current = { key, startX, startWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const active = resizingColRef.current;
      if (!active) return;
      const delta = moveEvent.clientX - active.startX;
      const newWidth = Math.max(35, active.startWidth + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (resizingColRef.current) {
        setColumnWidths((latest) => {
          saveWidths(latest);
          return latest;
        });
      }
      resizingColRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!hasManageStocks) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Stock Pricing</span> permission required to view or edit stock pricing.
        </p>
      </div>
    );
  }

  // Dialog State
  const [slabsDialogOpen, setSlabsDialogOpen] = useState(false);
  const [activeStockForSlabs, setActiveStockForSlabs] = useState<StockRow | null>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  async function loadStocks() {
    setLoading(true);
    setError(null);
    setSelectedStockIds(new Set());
    try {
      const data = await getAllStocksOperation();
      const rows: StockRow[] = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        isin: s.isin,
        cin: s.cin,
        price: s.price,
        isActive: s.isActive,
        discountSlabs: s.discountSlabs || [],
        internalLendingPrice: s.internalLendingPrice || null,
        externalLendingPrice: s.externalLendingPrice || null,
        backupQuantity: s.backupQuantity ?? 0,
        originalPrice: s.price,
        originalIsActive: s.isActive,
        originalDiscountSlabs: s.discountSlabs || [],
        originalInternalLendingPrice: s.internalLendingPrice || null,
        originalExternalLendingPrice: s.externalLendingPrice || null,
        originalBackupQuantity: s.backupQuantity ?? 0,
        isModified: false,
        isSaving: false,
      }));
      setStocks(rows);
    } catch (err: any) {
      setError(err.message || "Failed to load stocks");
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handlePriceChange = (id: string, newPriceStr: string) => {
    setStocks(current => 
      current.map(stock => {
        if (stock.id !== id) return stock;
        const newPrice = parseFloat(newPriceStr);
        const priceToSet = isNaN(newPrice) ? 0 : newPrice;
        const isModified = priceToSet !== stock.originalPrice || 
                           stock.isActive !== stock.originalIsActive ||
                           stock.internalLendingPrice !== stock.originalInternalLendingPrice ||
                           stock.externalLendingPrice !== stock.originalExternalLendingPrice ||
                           stock.backupQuantity !== stock.originalBackupQuantity ||
                           JSON.stringify(stock.discountSlabs || []) !== JSON.stringify(stock.originalDiscountSlabs || []);
        return { ...stock, price: priceToSet, isModified };
      })
    );
  };

  const handleInternalLendingPriceChange = (id: string, newPriceStr: string) => {
    setStocks(current => 
      current.map(stock => {
        if (stock.id !== id) return stock;
        const parsed = parseFloat(newPriceStr);
        const priceToSet = isNaN(parsed) ? null : parsed;
        const isModified = stock.price !== stock.originalPrice || 
                           stock.isActive !== stock.originalIsActive ||
                           priceToSet !== stock.originalInternalLendingPrice ||
                           stock.externalLendingPrice !== stock.originalExternalLendingPrice ||
                           stock.backupQuantity !== stock.originalBackupQuantity ||
                           JSON.stringify(stock.discountSlabs || []) !== JSON.stringify(stock.originalDiscountSlabs || []);
        return { ...stock, internalLendingPrice: priceToSet, isModified };
      })
    );
  };

  const handleExternalLendingPriceChange = (id: string, newPriceStr: string) => {
    setStocks(current => 
      current.map(stock => {
        if (stock.id !== id) return stock;
        const parsed = parseFloat(newPriceStr);
        const priceToSet = isNaN(parsed) ? null : parsed;
        const isModified = stock.price !== stock.originalPrice || 
                           stock.isActive !== stock.originalIsActive ||
                           stock.internalLendingPrice !== stock.originalInternalLendingPrice ||
                           priceToSet !== stock.originalExternalLendingPrice ||
                           stock.backupQuantity !== stock.originalBackupQuantity ||
                           JSON.stringify(stock.discountSlabs || []) !== JSON.stringify(stock.originalDiscountSlabs || []);
        return { ...stock, externalLendingPrice: priceToSet, isModified };
      })
    );
  };

  const handleBackupQuantityChange = (id: string, newQtyStr: string) => {
    setStocks(current => 
      current.map(stock => {
        if (stock.id !== id) return stock;
        const parsed = parseInt(newQtyStr, 10);
        const qtyToSet = isNaN(parsed) ? 0 : Math.max(0, parsed);
        const isModified = stock.price !== stock.originalPrice || 
                           stock.isActive !== stock.originalIsActive ||
                           stock.internalLendingPrice !== stock.originalInternalLendingPrice ||
                           stock.externalLendingPrice !== stock.originalExternalLendingPrice ||
                           qtyToSet !== stock.originalBackupQuantity ||
                           JSON.stringify(stock.discountSlabs || []) !== JSON.stringify(stock.originalDiscountSlabs || []);
        return { ...stock, backupQuantity: qtyToSet, isModified };
      })
    );
  };

  const handleActiveToggle = (id: string, isActive: boolean) => {
    setStocks(current => 
      current.map(stock => {
        if (stock.id !== id) return stock;
        const isModified = stock.price !== stock.originalPrice || 
                           isActive !== stock.originalIsActive ||
                           stock.internalLendingPrice !== stock.originalInternalLendingPrice ||
                           stock.externalLendingPrice !== stock.originalExternalLendingPrice ||
                           stock.backupQuantity !== stock.originalBackupQuantity ||
                           JSON.stringify(stock.discountSlabs || []) !== JSON.stringify(stock.originalDiscountSlabs || []);
        return { ...stock, isActive, isModified };
      })
    );
  };

  const handleSaveStock = async (stock: StockRow) => {
    try {
      stockPricingSchema.parse({
        price: stock.price,
        internalLendingPrice: stock.internalLendingPrice,
        externalLendingPrice: stock.externalLendingPrice,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        alert(err.issues[0]?.message || "Validation failed");
        return;
      }
    }

    setStocks(current => current.map(s => s.id === stock.id ? { ...s, isSaving: true } : s));
    try {
      await updateStockOperation(stock.id, {
        price: stock.price,
        isActive: stock.isActive,
        internalLendingPrice: stock.internalLendingPrice,
        externalLendingPrice: stock.externalLendingPrice,
        ...(stock.backupQuantity !== stock.originalBackupQuantity ? { backupQuantity: stock.backupQuantity ?? 0 } : {}),
        discountSlabs: stock.discountSlabs || [],
      });
      // Update original state to reflect saved changes
      setStocks(current => current.map(s => s.id === stock.id ? { 
        ...s, 
        originalPrice: s.price, 
        originalIsActive: s.isActive, 
        originalInternalLendingPrice: s.internalLendingPrice,
        originalExternalLendingPrice: s.externalLendingPrice,
        originalBackupQuantity: s.backupQuantity ?? 0,
        originalDiscountSlabs: s.discountSlabs || [],
        isModified: false,
        isSaving: false 
      } : s));
      alert("Stock pricing update submitted for approval.");
    } catch (err: any) {
      alert(`Failed to save stock: ${err.message}`);
      setStocks(current => current.map(s => s.id === stock.id ? { ...s, isSaving: false } : s));
    }
  };

  const handleCancelEdit = (id: string) => {
    setStocks(current => current.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        price: s.originalPrice,
        isActive: s.originalIsActive,
        internalLendingPrice: s.originalInternalLendingPrice,
        externalLendingPrice: s.originalExternalLendingPrice,
        backupQuantity: s.originalBackupQuantity ?? 0,
        discountSlabs: s.originalDiscountSlabs || [],
        isModified: false
      };
    }));
  };

  const handleOpenSlabsDialog = (stock: StockRow) => {
    setActiveStockForSlabs(stock);
    setSlabsDialogOpen(true);
  };

  const handleSaveSlabs = async (newSlabs: DiscountSlab[]) => {
    if (!activeStockForSlabs) return;
    const stockId = activeStockForSlabs.id;
    
    // Save slabs immediately
    setStocks(current => current.map(s => s.id === stockId ? { ...s, isSaving: true } : s));
    try {
      await updateStockOperation(stockId, { discountSlabs: newSlabs });
      setStocks(current => current.map(s => s.id === stockId ? { 
        ...s, 
        discountSlabs: newSlabs,
        originalDiscountSlabs: newSlabs,
        isSaving: false 
      } : s));
      alert("Discount slabs update submitted for approval.");
    } catch (err: any) {
      alert(`Failed to save discount slabs: ${err.message}`);
      setStocks(current => current.map(s => s.id === stockId ? { ...s, isSaving: false } : s));
    }
  };

  const filteredStocks = useMemo(() => {
    let list = stocks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.cin.toLowerCase().includes(q) ||
          (s.isin && s.isin.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "price") cmp = a.price - b.price;
      else if (sortField === "backupQuantity") cmp = (a.backupQuantity || 0) - (b.backupQuantity || 0);
      else if (sortField === "isActive") cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [stocks, searchQuery, sortField, sortDir]);

  const handleToggleSelect = (id: string) => {
    setSelectedStockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredStocks.map((s) => s.id);
    const allSelected = allFilteredIds.every((id) => selectedStockIds.has(id));
    setSelectedStockIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    if (selectedStockIds.size === 0) {
      alert("No rows selected for export.");
      return;
    }

    const rowsToExport = stocks.filter((s) => selectedStockIds.has(s.id));

    if (rowsToExport.length === 0) {
      alert("No stocks to export");
      return;
    }

    // Gather all unique slab minAmounts across selected stocks
    const slabAmountsSet = new Set<number>(STANDARD_SLAB_AMOUNTS);
    rowsToExport.forEach((s) => {
      s.discountSlabs?.forEach((slab) => {
        if (slab.minAmount > 0) slabAmountsSet.add(slab.minAmount);
      });
    });
    const sortedSlabAmounts = Array.from(slabAmountsSet).sort((a, b) => a - b);

    const headers = [
      "Stock Name",
      "ISIN",
      "CIN",
      "Base Price (INR)",
      "Internal Lending Price (INR)",
      "External Lending Price (INR)",
      ...sortedSlabAmounts.map((amt) => `Slab ${amt.toLocaleString("en-IN")} (INR)`),
      "Status",
    ];

    const rowsData = rowsToExport.map((s) => {
      const slabPriceMap = new Map<number, number>();
      s.discountSlabs?.forEach((slab) => {
        slabPriceMap.set(slab.minAmount, slab.pricePerShare);
      });

      const slabValues = sortedSlabAmounts.map((amt) => {
        const val = slabPriceMap.get(amt);
        return val !== undefined ? val : "";
      });

      return [
        s.name,
        s.isin || "",
        s.cin || "",
        s.price,
        s.internalLendingPrice !== null ? s.internalLendingPrice : "No floor",
        s.externalLendingPrice !== null ? s.externalLendingPrice : "No floor",
        ...slabValues,
        s.isActive ? "ACTIVE" : "HIDDEN",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rowsData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Pricing");
    XLSX.writeFile(wb, `stock_pricing_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleSaveAll = async () => {
    const modifiedStocks = stocks.filter((s) => s.isModified);
    if (modifiedStocks.length === 0) return;

    setStocks((current) =>
      current.map((s) => (s.isModified ? { ...s, isSaving: true } : s))
    );

    let successCount = 0;
    let failCount = 0;

    for (const stock of modifiedStocks) {
      try {
        await updateStockOperation(stock.id, {
          price: stock.price,
          isActive: stock.isActive,
          internalLendingPrice: stock.internalLendingPrice,
          externalLendingPrice: stock.externalLendingPrice,
          ...(stock.backupQuantity !== stock.originalBackupQuantity ? { backupQuantity: stock.backupQuantity ?? 0 } : {}),
          discountSlabs: stock.discountSlabs || [],
        });
        successCount++;
        setStocks((current) =>
          current.map((s) =>
            s.id === stock.id
              ? {
                  ...s,
                  originalPrice: s.price,
                  originalIsActive: s.isActive,
                  originalInternalLendingPrice: s.internalLendingPrice,
                  originalExternalLendingPrice: s.externalLendingPrice,
                  originalBackupQuantity: s.backupQuantity ?? 0,
                  originalDiscountSlabs: s.discountSlabs || [],
                  isModified: false,
                  isSaving: false,
                }
              : s
          )
        );
      } catch (err: any) {
        failCount++;
        setStocks((current) =>
          current.map((s) => (s.id === stock.id ? { ...s, isSaving: false } : s))
        );
      }
    }

    if (failCount > 0) {
      alert(`Saved ${successCount} stocks. Failed to save ${failCount} stocks.`);
    } else {
      alert(`Successfully saved all ${successCount} modified stocks.`);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        alert("Spreadsheet has no sheets.");
        return;
      }
      
      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        alert("Failed to load the first sheet.");
        return;
      }

      // Convert sheet to a 2D array of formatted text strings
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { 
        header: 1,
        raw: false,
        defval: ''
      });

      if (data.length < 2) {
        alert("Spreadsheet is empty or has no data rows.");
        return;
      }

      const rawHeaders = (data[0] as string[]).map((h) => String(h || "").trim());
      const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());

      const nameIdx = lowerHeaders.findIndex((h) => h.includes("name") || h.includes("stock"));
      const isinIdx = lowerHeaders.findIndex((h) => h.includes("isin"));
      const cinIdx = lowerHeaders.findIndex((h) => h.includes("cin"));
      const priceIdx = lowerHeaders.findIndex((h) => h.includes("price") && !h.includes("internal") && !h.includes("external") && !h.includes("slab") && !h.includes("lending"));
      const internalIdx = lowerHeaders.findIndex((h) => h.includes("internal"));
      const externalIdx = lowerHeaders.findIndex((h) => h.includes("external"));

      // Identify all discount slab columns
      interface SlabColInfo {
        colIdx: number;
        minAmount: number;
      }
      const slabCols: SlabColInfo[] = [];
      rawHeaders.forEach((h, colIdx) => {
        const parsedMinAmount = parseSlabHeader(h);
        if (parsedMinAmount && parsedMinAmount > 0) {
          slabCols.push({ colIdx, minAmount: parsedMinAmount });
        }
      });

      if (nameIdx === -1 && isinIdx === -1 && cinIdx === -1) {
        alert("Could not identify match columns (Stock Name, ISIN, or CIN) in headers");
        return;
      }

      let updatedCount = 0;

      setStocks((current) => {
        const nextStocks = [...current];

        for (let i = 1; i < data.length; i++) {
          const cols = data[i];
          if (!cols || cols.length === 0) continue;

          const csvName = nameIdx !== -1 ? String(cols[nameIdx] || "").replace(/^"|"$/g, "").trim() : "";
          const csvIsin = isinIdx !== -1 ? String(cols[isinIdx] || "").replace(/^"|"$/g, "").trim() : "";
          const csvCin = cinIdx !== -1 ? String(cols[cinIdx] || "").replace(/^"|"$/g, "").trim() : "";

          const matchIndex = nextStocks.findIndex((s) => {
            if (csvIsin && s.isin && s.isin.toLowerCase() === csvIsin.toLowerCase()) return true;
            if (csvCin && s.cin && s.cin.toLowerCase() === csvCin.toLowerCase()) return true;
            if (csvName && s.name.toLowerCase() === csvName.toLowerCase()) return true;
            return false;
          });

          if (matchIndex !== -1) {
            const matchedStock = nextStocks[matchIndex];
            if (!matchedStock) continue;

            let newPrice = matchedStock.price;
            let newInternal = matchedStock.internalLendingPrice;
            let newExternal = matchedStock.externalLendingPrice;
            let newSlabs = matchedStock.discountSlabs ? [...matchedStock.discountSlabs] : [];
            let modified = false;

            if (priceIdx !== -1 && cols[priceIdx] !== undefined && String(cols[priceIdx]).trim() !== "") {
              const val = parseFloat(String(cols[priceIdx]).replace(/,/g, ""));
              if (!isNaN(val)) {
                newPrice = val;
                if (newPrice !== matchedStock.originalPrice) modified = true;
              }
            }

            if (internalIdx !== -1 && cols[internalIdx] !== undefined) {
              const valStr = String(cols[internalIdx]).toLowerCase().trim();
              if (valStr === "no floor" || valStr === "" || valStr === "null") {
                newInternal = null;
              } else {
                const val = parseFloat(valStr.replace(/,/g, ""));
                if (!isNaN(val)) {
                  newInternal = val;
                }
              }
              if (newInternal !== matchedStock.originalInternalLendingPrice) modified = true;
            }

            if (externalIdx !== -1 && cols[externalIdx] !== undefined) {
              const valStr = String(cols[externalIdx]).toLowerCase().trim();
              if (valStr === "no floor" || valStr === "" || valStr === "null") {
                newExternal = null;
              } else {
                const val = parseFloat(valStr.replace(/,/g, ""));
                if (!isNaN(val)) {
                  newExternal = val;
                }
              }
              if (newExternal !== matchedStock.originalExternalLendingPrice) modified = true;
            }

            // Process discount slab columns
            if (slabCols.length > 0) {
              const slabMap = new Map<number, number>();
              // Keep existing non-overridden slabs if any
              newSlabs.forEach((s) => slabMap.set(s.minAmount, s.pricePerShare));

              slabCols.forEach(({ colIdx, minAmount }) => {
                const rawCell = cols[colIdx];
                if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== "") {
                  const cleanedStr = String(rawCell).replace(/,/g, "").trim();
                  const parsedPrice = parseFloat(cleanedStr);
                  if (!isNaN(parsedPrice) && parsedPrice > 0) {
                    slabMap.set(minAmount, parsedPrice);
                  }
                }
              });

              const updatedSlabsArray = Array.from(slabMap.entries())
                .map(([minAmount, pricePerShare]) => ({ minAmount, pricePerShare }))
                .sort((a, b) => a.minAmount - b.minAmount);

              if (JSON.stringify(updatedSlabsArray) !== JSON.stringify(matchedStock.originalDiscountSlabs || [])) {
                newSlabs = updatedSlabsArray;
                modified = true;
              }
            }

            if (modified) {
              nextStocks[matchIndex] = {
                ...matchedStock,
                price: newPrice,
                internalLendingPrice: newInternal,
                externalLendingPrice: newExternal,
                discountSlabs: newSlabs,
                isModified: true,
              };
              updatedCount++;
            }
          }
        }

        return nextStocks;
      });

      alert(`Spreadsheet import complete. Updated prices & discount slabs for ${updatedCount} stocks locally. Review highlighted changes and click 'Save All Changes'.`);
    } catch (err: any) {
      alert(`Failed to parse file: ${err.message}`);
    }
    e.target.value = "";
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Stock Pricing</h1>
        <p className="text-sm font-medium text-[#64748B]">Manage base prices, trading status, and quantity-based discount slabs</p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]/50" />
          <Input
            placeholder="Search by name, ISIN, or CIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl border border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 text-sm font-medium transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          {selectedStockIds.size > 0 && (
            <span className="text-xs font-semibold text-[#64748B]">
              {selectedStockIds.size} row{selectedStockIds.size > 1 ? "s" : ""} selected
            </span>
          )}

          {/* Import CSV/Excel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="h-10 px-4 rounded-xl border border-neutral-200 hover:border-neutral-300 text-slate-700 font-semibold text-sm transition-all"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV/Excel
          </Button>

          {/* Export CSV */}
          <Button
            onClick={handleExportCSV}
            disabled={selectedStockIds.size === 0}
            className="h-10 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-sm transition-all animate-in fade-in-50 duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Download className="h-4 w-4 mr-2" />
            {selectedStockIds.size > 0 ? `Export Selected (${selectedStockIds.size})` : "Export Selected"}
          </Button>

          {/* Save All Changes */}
          {stocks.some((s) => s.isModified) && (
            <Button
              onClick={handleSaveAll}
              disabled={stocks.some((s) => s.isSaving)}
              className="h-10 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-sm transition-all shadow-md shadow-green-600/10 animate-in zoom-in-95 duration-200 cursor-pointer"
            >
              {stocks.some((s) => s.isSaving) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All Changes
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl bg-white border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Card Subheader with Reset Widths & Total/Selected Count */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E5E7EB] bg-white">
          <button
            onClick={resetAllColumnWidths}
            className="text-[11px] font-medium text-[#6B7280] hover:text-[#111827] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset all column widths to default"
          >
            <RotateCcw size={12} />
            Reset column widths
          </button>

          <div className="flex items-center gap-3 text-xs text-[#4B5563]">
            {selectedStockIds.size > 0 && (
              <span className="inline-flex items-center rounded-md bg-[#ECFDF5] border border-[#16A34A]/20 px-2 py-0.5 text-xs font-semibold text-[#16A34A]">
                {selectedStockIds.size} selected
              </span>
            )}
            <span>
              Total <span className="font-semibold text-[#111827]">{filteredStocks.length}</span> stocks
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#16A34A] mb-3" />
            <p className="font-bold text-sm text-[#64748B]">Loading stocks...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
            <p className="font-bold text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <colgroup>
                {COLUMNS_CONFIG.map((col) => (
                  <col
                    key={col.key}
                    style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px` }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {COLUMNS_CONFIG.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: `${columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px` }}
                      className={cn(
                        "relative px-3 py-2.5 border-r border-b border-[#E5E7EB] last:border-r-0 text-[12px] font-semibold text-[#374151] select-none whitespace-nowrap overflow-hidden text-ellipsis",
                        col.align === 'center' && "text-center",
                        col.align === 'right' && "text-right",
                        col.sortable && "cursor-pointer hover:bg-neutral-100/60"
                      )}
                      onClick={() => {
                        if (col.sortable && col.sortKey) {
                          handleSort(col.sortKey);
                        }
                      }}
                    >
                      {col.key === 'sno' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filteredStocks.length > 0 && filteredStocks.every((s) => selectedStockIds.has(s.id))}
                            onChange={handleToggleSelectAll}
                            aria-label="Select all stocks"
                            className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A] h-4 w-4 cursor-pointer accent-[#16A34A] translate-y-[1px]"
                          />
                          <span>S.No</span>
                        </div>
                      ) : (
                        <div className={cn("inline-flex items-center gap-1", col.align === 'center' && "justify-center", col.align === 'right' && "justify-end")}>
                          <span title={col.label}>{col.label}</span>
                          {col.sortable && <ArrowUpDown className="h-3 w-3 text-slate-400 shrink-0" />}
                        </div>
                      )}
                      {/* Column resizer handle */}
                      <div
                        onMouseDown={(e) => startResizing(col.key, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          resetColumnWidth(col.key);
                        }}
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-[#3B82F6] active:bg-[#2563EB] z-10 transition-colors"
                        title="Drag to resize, double-click to reset"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-[#0F172A] text-sm">No stocks found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock, idx) => {
                    const isSelected = selectedStockIds.has(stock.id);
                    return (
                      <tr
                        key={stock.id}
                        className={cn(
                          "hover:bg-[#F9FAFB] transition-colors duration-150 text-[12px]",
                          isSelected && "bg-[#ECFDF5]/30 hover:bg-[#ECFDF5]/50"
                        )}
                      >
                        {/* S.No + Checkbox (single column, no separation) */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(stock.id)}
                              aria-label={`Select ${stock.name}`}
                              className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A] h-4 w-4 cursor-pointer accent-[#16A34A] translate-y-[1px]"
                            />
                            <span className="text-[#64748B] font-semibold tabular-nums text-xs">
                              {idx + 1}
                            </span>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-3 py-2 font-medium text-[#0F172A] text-xs truncate" title={stock.name}>
                          {stock.name}
                        </td>

                        {/* ISIN / CIN */}
                        <td className="px-3 py-2 truncate">
                          <div className="flex flex-col min-w-0">
                            {stock.isin ? (
                              <span className="font-mono font-semibold text-[#0F172A] text-xs truncate" title={stock.isin}>
                                {stock.isin}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No ISIN</span>
                            )}
                            <span className="font-mono text-[10px] text-[#64748B] truncate" title={stock.cin}>
                              {stock.cin}
                            </span>
                          </div>
                        </td>

                        {/* Price Input */}
                        <td className="px-3 py-2">
                          <PriceStepper
                            value={stock.price}
                            originalValue={stock.originalPrice}
                            onChange={(val) => handlePriceChange(stock.id, val)}
                            disabled={stock.isSaving}
                          />
                        </td>

                        {/* Internal Lending Price */}
                        <td className="px-3 py-2">
                          <PriceStepper
                            value={stock.internalLendingPrice}
                            originalValue={stock.originalInternalLendingPrice}
                            onChange={(val) => handleInternalLendingPriceChange(stock.id, val)}
                            disabled={stock.isSaving}
                            allowNull={true}
                            placeholder="No floor"
                            max={stock.price}
                          />
                        </td>

                        {/* External Lending Price */}
                        <td className="px-3 py-2">
                          <PriceStepper
                            value={stock.externalLendingPrice}
                            originalValue={stock.originalExternalLendingPrice}
                            onChange={(val) => handleExternalLendingPriceChange(stock.id, val)}
                            disabled={stock.isSaving}
                            allowNull={true}
                            placeholder="No floor"
                            max={stock.price}
                          />
                        </td>

                        {/* Backup Qty Input */}
                        <td className="px-3 py-2">
                          <div className={cn(
                            "flex items-center h-7 rounded-md border bg-white shadow-xs overflow-hidden transition-all",
                            stock.backupQuantity !== stock.originalBackupQuantity
                              ? "border-amber-400 bg-amber-50/20 ring-1 ring-amber-300"
                              : "border-neutral-200 focus-within:ring-1 focus-within:ring-[#16A34A] focus-within:border-[#16A34A]"
                          )}>
                            <input
                              type="number"
                              min={0}
                              value={stock.backupQuantity ?? 0}
                              onChange={(e) => handleBackupQuantityChange(stock.id, e.target.value)}
                              disabled={stock.isSaving}
                              className="w-full h-full px-2 text-center font-mono text-xs font-bold text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </td>

                        {/* Slabs */}
                        <td className="px-3 py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5 rounded-md border-dashed border-neutral-300 hover:border-[#16A34A] hover:text-[#16A34A] hover:bg-[#ECFDF5] w-full cursor-pointer"
                            onClick={() => handleOpenSlabsDialog(stock)}
                            disabled={stock.isSaving}
                          >
                            <Layers className="h-3 w-3 mr-1 text-[#16A34A]" />
                            {stock.discountSlabs?.length || 0} Slabs
                          </Button>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={stock.isActive}
                              onCheckedChange={(val: boolean) => handleActiveToggle(stock.id, val)}
                              disabled={stock.isSaving}
                              className="data-[state=checked]:bg-[#16A34A]"
                            />
                            <span className={cn(
                              "text-[10px] font-bold w-12 text-left",
                              stock.isActive ? "text-[#16A34A]" : "text-slate-400"
                            )}>
                              {stock.isActive ? "ACTIVE" : "HIDDEN"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-right">
                          {stock.isModified ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                                onClick={() => handleCancelEdit(stock.id)}
                                disabled={stock.isSaving}
                                title="Cancel changes"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#16A34A] hover:text-[#15803D] hover:bg-[#ECFDF5] rounded-md cursor-pointer"
                                onClick={() => handleSaveStock(stock)}
                                disabled={stock.isSaving}
                                title="Save changes"
                              >
                                {stock.isSaving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 opacity-60">
                              <Check className="h-3.5 w-3.5 text-[#16A34A] mr-1" />
                              <span className="text-[10px] font-bold text-slate-400 tracking-wider">SAVED</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeStockForSlabs && (
        <DiscountSlabsDialog
          open={slabsDialogOpen}
          onOpenChange={setSlabsDialogOpen}
          stockName={activeStockForSlabs.name}
          initialSlabs={activeStockForSlabs.discountSlabs || []}
          basePrice={activeStockForSlabs.price}
          onSave={handleSaveSlabs}
        />
      )}
    </div>
  );
}
