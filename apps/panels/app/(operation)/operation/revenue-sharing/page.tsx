"use client";

import { useState, useEffect } from "react";
import { 
  Percent, 
  Loader2, 
  AlertCircle, 
  TrendingUp, 
  IndianRupee, 
  Share2, 
  CheckCircle2,
  Minus,
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  getRevenueSharingSettings, 
  updateRevenueSharingSettings 
} from "@/lib/settings-api";
import { useAuthStore } from "@/store/auth-store";

interface PercentageStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
}

function PercentageStepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.5,
  disabled = false,
  placeholder = "0",
}: PercentageStepperProps) {
  const [textVal, setTextVal] = useState<string>(String(value ?? 0));

  useEffect(() => {
    setTextVal(String(value ?? 0));
  }, [value]);

  const handleStep = (delta: number, e: React.MouseEvent) => {
    if (disabled) return;
    const stepSize = e.shiftKey ? 5 : step;
    let next = Math.round(((value || 0) + delta * stepSize) * 100) / 100;
    if (next < min) next = min;
    if (next > max) next = max;
    setTextVal(String(next));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextVal(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(textVal);
    if (isNaN(parsed)) {
      setTextVal(String(min));
      onChange(min);
    } else {
      const clamped = Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
      setTextVal(String(clamped));
      onChange(clamped);
    }
  };

  return (
    <div className="flex items-center h-11 w-full rounded-xl border border-neutral-200 bg-white transition-all overflow-hidden focus-within:border-[#16A34A] focus-within:ring-2 focus-within:ring-[#16A34A]/20">
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => handleStep(-1, e)}
        disabled={disabled || value <= min}
        className="h-full w-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-r border-neutral-200"
        title="Decrease (Hold Shift for 5%)"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="relative flex-1 min-w-0 flex items-center justify-center px-3">
        <input
          type="number"
          min={min}
          max={max}
          step="any"
          disabled={disabled}
          placeholder={placeholder}
          value={textVal}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className="w-full h-full bg-transparent text-center font-semibold text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-xs font-bold text-slate-400 select-none shrink-0 pointer-events-none">
          %
        </span>
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => handleStep(1, e)}
        disabled={disabled || value >= max}
        className="h-full w-10 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none cursor-pointer select-none border-l border-neutral-200"
        title="Increase (Hold Shift for 5%)"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function RevenueSharingPage() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasRevenueSharing = operationAdmin?.permissions?.includes('revenue_sharing') || isSuperAdmin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Internal RM settings
  const [internalRevenue, setInternalRevenue] = useState<number>(0);
  const [internalIncentive, setInternalIncentive] = useState<number>(0);
  const [isSavingInternal, setIsSavingInternal] = useState(false);

  // External Distributor settings
  const [externalRevenue, setExternalRevenue] = useState<number>(0);
  const [isSavingExternal, setIsSavingExternal] = useState(false);

  useEffect(() => {
    if (hasRevenueSharing) {
      fetchSettings();
    }
  }, [hasRevenueSharing]);

  if (!hasRevenueSharing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Revenue Sharing</span> permission required to view or configure revenue sharing settings.
        </p>
      </div>
    );
  }

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRevenueSharingSettings();
      const internal = data.find((s) => s.type === "INTERNAL");
      const external = data.find((s) => s.type === "EXTERNAL");

      if (internal) {
        setInternalRevenue(internal.revenuePercentage);
        setInternalIncentive(internal.incentivePercentage);
      }
      if (external) {
        setExternalRevenue(external.revenuePercentage);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load revenue sharing settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInternal(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateRevenueSharingSettings({
        type: "INTERNAL",
        revenuePercentage: internalRevenue,
        incentivePercentage: internalIncentive,
      });
      setSuccessMsg("Internal RM revenue sharing update submitted for approval.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings.");
    } finally {
      setIsSavingInternal(false);
    }
  };

  const handleApplyExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExternal(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateRevenueSharingSettings({
        type: "EXTERNAL",
        revenuePercentage: externalRevenue,
      });
      setSuccessMsg("External Distributor revenue sharing update submitted for approval.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings.");
    } finally {
      setIsSavingExternal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
          <p className="text-sm font-medium text-slate-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Revenue Sharing</h1>
        <p className="text-sm font-medium text-[#64748B]">
          Configure revenue sharing percentages. Revenue is calculated as:{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-700 font-bold">
            Revenue = Selling Price - Lending Price
          </code>
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-250 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-emerald-800">{successMsg}</p>
        </div>
      )}

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Card 1: Internal Revenue Sharing */}
        <div className="bg-white rounded-3xl border border-slate-150/60 shadow-xl shadow-slate-100 p-8 flex flex-col justify-between">
          <form onSubmit={handleApplyInternal} className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-bold text-slate-900">Internal Revenue Sharing - Our SMC RMs</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Set revenue split rules for internal SMC Relationship Managers.
              </p>
            </div>

            <div className="space-y-4">
              {/* Revenue Percentage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Revenue Percentage
                </label>
                <PercentageStepper
                  value={internalRevenue}
                  onChange={setInternalRevenue}
                  disabled={isSavingInternal}
                />
              </div>

              {/* Incentive Percentage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Incentive Percentage
                </label>
                <PercentageStepper
                  value={internalIncentive}
                  onChange={setInternalIncentive}
                  disabled={isSavingInternal}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isSavingInternal}
                className="px-6 h-11 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center min-w-[100px]"
              >
                {isSavingInternal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Card 2: External Revenue Sharing */}
        <div className="bg-white rounded-3xl border border-slate-150/60 shadow-xl shadow-slate-100 p-8 flex flex-col justify-between">
          <form onSubmit={handleApplyExternal} className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-bold text-slate-900">External Revenue Sharing- Distributor</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Set revenue split rules for external partner distributors.
              </p>
            </div>

            <div className="space-y-4">
              {/* Revenue Percentage */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Revenue Percentage
                </label>
                <PercentageStepper
                  value={externalRevenue}
                  onChange={setExternalRevenue}
                  disabled={isSavingExternal}
                />
              </div>
            </div>

            <div className="flex justify-end pt-12">
              <Button
                type="submit"
                disabled={isSavingExternal}
                className="px-6 h-11 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center min-w-[100px]"
              >
                {isSavingExternal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </Button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
