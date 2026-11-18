"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Landmark,
  TrendingUp,
  ShoppingBag,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Layers,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createLedger, fetchGroups, type AccountingGroup, type Ledger } from "@/lib/accounting-api";

// ──────────────────────────────────────────────────────────
// Per-type config
// ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;
  accentBtn: string;
  accentRing: string;
  accentFocus: string;
}> = {
  SALE: {
    label: "Create Sale Ledger",
    sublabel: "A ledger that tracks all your sales transactions",
    icon: TrendingUp,
    accent: "bg-emerald-500",
    accentBtn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    accentRing: "focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100",
    accentFocus: "focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100",
  },
  PURCHASE: {
    label: "Create Purchases Ledger",
    sublabel: "A ledger that tracks all your purchase transactions",
    icon: ShoppingBag,
    accent: "bg-amber-500",
    accentBtn: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
    accentRing: "focus:border-amber-300 focus:ring-2 focus:ring-amber-100",
    accentFocus: "focus:border-amber-300 focus:ring-1 focus:ring-amber-100",
  },
  BANK: {
    label: "Create Bank Ledger",
    sublabel: "A bank account ledger for tracking cash flows",
    icon: Landmark,
    accent: "bg-blue-500",
    accentBtn: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
    accentRing: "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
    accentFocus: "focus:border-blue-300 focus:ring-1 focus:ring-blue-100",
  },
};

export default function CreateLedgerPopup() {
  const searchParams = useSearchParams();
  const ledgerType = (searchParams.get("type") || "BANK").toUpperCase();
  const config = (TYPE_CONFIG[ledgerType] || TYPE_CONFIG.BANK)!;
  const Icon = config.icon;
  const isBank = ledgerType === "BANK";

  // Form fields
  const [name, setName]                   = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [address, setAddress]             = useState("");
  const [groupId, setGroupId]             = useState("");

  // Bank-only
  const [bankName, setBankName]           = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode]           = useState("");

  // Groups
  const [groups, setGroups]               = useState<AccountingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [createdLedger, setCreatedLedger] = useState<Ledger | null>(null);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    fetchGroups()
      .then((res) => setGroups((res.groups || []).filter((g) => g.name !== "Stocks")))
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Ledger name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const selectedGroup = groups.find((g) => g.id === groupId);
      const derivedType = selectedGroup
        ? selectedGroup.name === "Stocks" || selectedGroup.under === "Stocks"
          ? "STOCK"
          : selectedGroup.under === "Bank Accounts"
          ? "BANK"
          : selectedGroup.under === "Sales Accounts" ||
            selectedGroup.under === "Direct Income" ||
            selectedGroup.under === "Indirect Income"
          ? "SALE"
          : selectedGroup.under === "Purchase Accounts"
          ? "PURCHASE"
          : "USER"
        : (ledgerType as "SALE" | "PURCHASE" | "BANK" | "STOCK");

      const newLedger = await createLedger({
        name: name.trim(),
        type: derivedType as any,
        openingBalance: parseFloat(openingBalance) || 0,
        address: address || undefined,
        groupId: groupId || undefined,
        ...(isBank
          ? {
              bankName:      bankName      || undefined,
              accountNumber: accountNumber || undefined,
              ifscCode:      ifscCode      || undefined,
            }
          : {}),
      });
      setCreatedLedger(newLedger);
      setSuccess(true);
      if (window.opener) {
        window.opener.postMessage({ type: "LEDGER_CREATED" }, "*");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to create ledger");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = cn(
    "w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white outline-none transition-all",
    config.accentRing
  );
  const selectClass = cn(
    "w-full px-4 py-3 text-sm rounded-xl border border-slate-200 bg-white outline-none transition-all cursor-pointer",
    config.accentFocus
  );

  if (success && createdLedger) {
    const selected = groups.find((g) => g.id === createdLedger.groupId);
    const groupName = createdLedger.group?.name || (selected ? selected.name : "—");
    const groupCode = createdLedger.group?.code || (selected ? (selected.code || selected.id.slice(-6).toUpperCase()) : "—");

    const formatDate = (dateString?: string) => {
      if (!dateString) return new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col p-6 items-center justify-center">
        <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 bg-emerald-50/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Ledger Created Successfully
                </h2>
                <p className="text-xs text-emerald-700 font-bold tracking-wide uppercase mt-0.5">
                  Tally Accounting Master Data
                </p>
              </div>
            </div>
            <button
              onClick={() => window.close()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Details Table */}
          <div className="p-6 space-y-6">
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 font-bold min-w-[60px] text-center">Sr No</th>
                      <th className="py-3.5 px-4 font-bold min-w-[120px]">Ledger Code</th>
                      <th className="py-3.5 px-4 font-bold min-w-[160px]">Ledger Name</th>
                      <th className="py-3.5 px-4 font-bold min-w-[150px]">Group Name</th>
                      <th className="py-3.5 px-4 font-bold min-w-[110px]">Group Code</th>
                      <th className="py-3.5 px-4 font-bold min-w-[120px]">Sun Code</th>
                      <th className="py-3.5 px-4 font-bold min-w-[160px]">Sun Ledger Name</th>
                      <th className="py-3.5 px-4 font-bold min-w-[140px] pr-5">Creation Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400 text-center">1</td>
                      <td className="py-4 px-4 font-mono font-bold text-emerald-700">
                        <span className="bg-emerald-50 px-2 py-0.5 rounded-md">
                          {createdLedger.code || "—"}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">{createdLedger.name}</td>
                      <td className="py-4 px-4 font-semibold text-slate-600">{groupName}</td>
                      <td className="py-4 px-4 font-mono font-bold text-amber-700">
                        <span className="bg-amber-50 px-2 py-0.5 rounded-md">
                          {groupCode}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600">{createdLedger.sunCode || "—"}</td>
                      <td className="py-4 px-4 font-medium text-slate-700">{createdLedger.sunName || "—"}</td>
                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap pr-5 font-semibold">
                        {formatDate(createdLedger.createdAt)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-xs text-emerald-800">
              <Plus className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-extrabold">Ledger Master Record Synced</p>
                <p className="mt-0.5 text-emerald-700 font-medium">
                  This ledger has been synced to the Chart of Accounts. You can now select it to post journal, sales, purchase, payment, or receipt vouchers.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              onClick={() => window.close()}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group options grouped by "under" for visual clarity
  const groupsByParent = groups.reduce<Record<string, AccountingGroup[]>>((acc, g) => {
    const key = g.under || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg", config.accent)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{config.label}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{config.sublabel}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-8 w-full">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 border border-rose-100">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-700 font-medium">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Ledger Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isBank ? "e.g. HDFC Current Account"
                : ledgerType === "SALE" ? "e.g. Sales Account"
                : "e.g. Purchases Account"
              }
              required
              autoFocus
              className={inputClass}
            />
          </div>

          {/* Group selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Group
              <span className="text-slate-300 font-normal normal-case">(optional)</span>
            </label>
            {groupsLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading groups...
              </div>
            ) : (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className={selectClass}
              >
                <option value="">— No Group —</option>
                {groups.length === 0 ? (
                  <option disabled>No groups created yet</option>
                ) : (
                  Object.entries(groupsByParent).map(([parent, items]) => (
                    <optgroup key={parent} label={parent}>
                      {items.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}{g.alias ? ` (${g.alias})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            )}
            {groups.length === 0 && !groupsLoading && (
              <p className="text-[10px] text-slate-400 mt-1">
                No groups yet. Create groups via <strong>Dashboard → Create → Group</strong>.
              </p>
            )}
          </div>

          {/* Opening Balance */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Opening Balance (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Leave as 0 if starting fresh. Positive = Debit balance, Negative = Credit balance.
            </p>
          </div>

          {/* Bank-specific fields */}
          {isBank && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account number"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="e.g. HDFC0001234"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Address */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
              Address <span className="text-slate-300 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
              rows={3}
              className={cn(inputClass, "resize-none")}
            />
          </div>

          {/* Submit */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "w-full py-3 text-sm font-bold rounded-xl text-white shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                config.accentBtn
              )}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                : <><Plus className="h-4 w-4" /> Create Ledger</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
