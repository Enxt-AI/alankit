"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Lock, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAccountingPeriod, updateAccountingPeriod, type AccountingPeriod } from "@/lib/accounting-api";
import { DatePicker } from "@/components/ui/date-picker";

export function PeriodLockDialog({
  open,
  onClose,
  onCreated,
  periodToAlter,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  periodToAlter?: AccountingPeriod | null;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lockStartDate, setLockStartDate] = useState("");
  const [lockEndDate, setLockEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (periodToAlter) {
        setName(periodToAlter.name);
        setStartDate((periodToAlter.startDate || "").split("T")[0] || "");
        setEndDate((periodToAlter.endDate || "").split("T")[0] || "");
        setLockStartDate((periodToAlter.lockStartDate || "").split("T")[0] || "");
        setLockEndDate((periodToAlter.lockEndDate || "").split("T")[0] || "");
      } else {
        setName("FY 2026-27");
        setStartDate("2026-04-01");
        setEndDate("2027-03-31");
        setLockStartDate("");
        setLockEndDate("");
      }
    }
  }, [open, periodToAlter]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Period Name is required"); return; }
    if (!startDate) { setError("Financial Year Start Date is required"); return; }
    if (!endDate) { setError("Financial Year End Date is required"); return; }

    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
      setError("FY Start Date must be before End Date");
      return;
    }

    if ((lockStartDate && !lockEndDate) || (!lockStartDate && lockEndDate)) {
      setError("Please set both Lock Start Date and Lock End Date to freeze a range.");
      return;
    }

    if (lockStartDate && lockEndDate) {
      if (new Date(lockStartDate).getTime() > new Date(lockEndDate).getTime()) {
        setError("Lock Start Date cannot be after Lock End Date");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        startDate,
        endDate,
        lockStartDate: lockStartDate || undefined,
        lockEndDate: lockEndDate || undefined,
      };

      if (periodToAlter) {
        await updateAccountingPeriod(periodToAlter.id, {
          ...payload,
          lockStartDate: lockStartDate || null,
          lockEndDate: lockEndDate || null,
        });
      } else {
        await createAccountingPeriod(payload);
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to configure period");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all duration-150";
  const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-7 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {periodToAlter ? "Alter Accounting Period" : "Set Accounting Period Lock"}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {periodToAlter
                  ? "Modify boundary configurations and lock freeze gates"
                  : "Establish standard financial year and lock historical dates"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-3 border border-rose-100 animate-shake">
              <X className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Period Name */}
          <div>
            <label className={labelCls}>Financial Year Label / Name</label>
            <input
              type="text"
              placeholder="e.g. FY 2026-27"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {/* FY Boundaries */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Financial Year Boundaries</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>FY Start Date</label>
                <DatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>FY End Date</label>
                <DatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Lock/Freeze range */}
          <div className="bg-amber-50/20 border border-amber-100/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Security Period Lock</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Define the dates to completely block any voucher creation, amendment, approval, or reversal. Leave empty to allow unlocked operations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Lock Start Date (Optional)</label>
                <DatePicker
                  value={lockStartDate}
                  onChange={(val) => setLockStartDate(val)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Lock End Date (Optional)</label>
                <DatePicker
                  value={lockEndDate}
                  onChange={(val) => setLockEndDate(val)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
