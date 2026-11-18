"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  FileText,
  FileCheck,
  Building2,
  Users,
  Scale,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Wallet,
  Plus,
  ChevronRight,
  ArrowLeft,
  FolderPlus,
  BookPlus,
  Package,
  Receipt,
  Landmark,
  UserCheck,
  ShoppingCart,
  ShoppingBag,
  X,
  Check,
  CheckCircle2,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fetchLedgers, createLedger, createVoucher, createGroup, suspendLedger, Ledger, fetchSunAccounts } from "@/lib/accounting-api";

// ============================================
// CREATE MENU (Floating Action Button)
// ============================================

function CreateMenu({
  open,
  onClose,
  onCreateGroup,
  onCreateVoucher,
}: {
  open: boolean;
  onClose: () => void;
  onCreateGroup: (group: string) => void;
  onCreateVoucher: (type: string) => void;
}) {
  const [step, setStep] = useState<"root" | "voucher">("root");

  useEffect(() => {
    if (open) setStep("root");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div className="relative px-6 pt-6 pb-4">
          {step !== "root" && (
            <button
              onClick={() => setStep("root")}
              className="absolute left-5 top-6 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}

          <div className="text-center">
            {/* Breadcrumb dots */}
            <div className="inline-flex items-center gap-1 mb-2">
              <span className={cn("h-1.5 rounded-full transition-all duration-300", step === "root" ? "w-4 bg-emerald-500" : "w-1.5 bg-slate-200")} />
              <span className={cn("h-1.5 rounded-full transition-all duration-300", step === "voucher" ? "w-4 bg-emerald-500" : "w-1.5 bg-slate-200")} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {step === "root"    && "Create New"}
              {step === "voucher" && "Select Voucher Type"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {step === "root"    && "What would you like to create?"}
              {step === "voucher" && "Entries are automatically posted to the matching ledger"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="absolute right-5 top-6 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Root — 2-col icon grid ──────────────────── */}
        {step === "root" && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStep("voucher")}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg group-hover:shadow-violet-200 group-hover:shadow-xl transition-all">
                  <Package className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-extrabold text-slate-900">Voucher</p>
                  <p className="text-[11px] text-slate-400 leading-tight mt-1">Create a journal entry.<br/>Entries auto-post to ledgers.</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {["Sale", "Purchase", "Payment", "Receipt", "Journal"].map(t => (
                    <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">{t}</span>
                  ))}
                </div>
              </button>

              <button
                onClick={() => { onCreateGroup("GROUP"); onClose(); }}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg group-hover:shadow-amber-200 group-hover:shadow-xl transition-all">
                  <FolderPlus className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-extrabold text-slate-900">Group</p>
                  <p className="text-[11px] text-slate-400 leading-tight mt-1">Create a ledger group<br/>for classification.</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {["Capital A/C", "Bank A/C", "Sales A/C"].map(t => (
                    <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">{t}</span>
                  ))}
                </div>
              </button>
            </div>

            {/* Info strip */}
            <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 mt-0.5">
                <BookOpen className="h-3 w-3 text-blue-600" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong className="text-slate-700">Ledgers are system-managed.</strong> Sale, Purchase, Bank &amp; User ledgers are created automatically. Just create vouchers — entries will be posted to the right ledger.
              </p>
            </div>
          </div>
        )}

        {/* ── Voucher Types ───────────────────────────── */}
        {step === "voucher" && (
          <div className="px-6 pb-6 space-y-2">
            {[
              {
                label: "Sale Voucher",
                key: "SALE",
                icon: ShoppingCart,
                gradient: "from-emerald-400 to-emerald-600",
                description: "Record a stock sale transaction",
                posts: "Sale Ledger (Cr)",
                postsColor: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "Purchase Voucher",
                key: "PURCHASE",
                icon: ShoppingBag,
                gradient: "from-amber-400 to-orange-500",
                description: "Record a stock purchase transaction",
                posts: "Purchase Ledger (Dr)",
                postsColor: "bg-amber-50 text-amber-700",
              },
              {
                label: "Payment Voucher",
                key: "PAYMENT",
                icon: FileCheck,
                gradient: "from-blue-400 to-blue-600",
                description: "Record an outgoing payment",
                posts: "Bank Ledger (Cr)",
                postsColor: "bg-blue-50 text-blue-700",
              },
              {
                label: "Receipt Voucher",
                key: "RECEIPT",
                icon: Receipt,
                gradient: "from-cyan-400 to-cyan-600",
                description: "Record an incoming receipt",
                posts: "Bank Ledger (Dr)",
                postsColor: "bg-cyan-50 text-cyan-700",
              },
              {
                label: "Journal Voucher",
                key: "JOURNAL",
                icon: BookOpen,
                gradient: "from-violet-400 to-violet-600",
                description: "Manual adjustment / general entry",
                posts: "Any Ledger",
                postsColor: "bg-violet-50 text-violet-700",
              },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => { onCreateVoucher(v.key); onClose(); }}
                className="group flex items-center gap-4 w-full p-3.5 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-lg hover:-translate-y-0.5 bg-white transition-all duration-200 text-left"
              >
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm group-hover:shadow-md transition-shadow",
                  v.gradient
                )}>
                  <v.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{v.label}</p>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", v.postsColor)}>
                      → {v.posts}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{v.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





// ============================================
// CREATE LEDGER DIALOG
// ============================================

function CreateLedgerDialog({
  open,
  onClose,
  ledgerType,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  ledgerType: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pan, setPan] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [address, setAddress] = useState("");
  const [sunCode, setSunCode] = useState("");
  const [sunName, setSunName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdLedger, setCreatedLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sunAccounts, setSunAccounts] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      setName(""); setOpeningBalance(""); setPhone(""); setEmail("");
      setPan(""); setBankName(""); setAccountNumber(""); setIfscCode(""); setAddress("");
      setSunCode(""); setSunName("");
      setSubmitting(false); setSuccess(false); setCreatedLedger(null); setError(null);
    }
  }, [open, ledgerType]);

  useEffect(() => {
    if (open) {
      fetchSunAccounts()
        .then((res) => {
          setSunAccounts(res || []);
        })
        .catch((err) => {
          console.error("Failed to load sun accounts from DB", err);
          setSunAccounts([]);
        });
    }
  }, [open]);

  useEffect(() => {
    const matched = sunAccounts.find((s) => s.code === sunCode);
    setSunName(matched ? matched.name : "");
  }, [sunCode, sunAccounts]);

  if (!ledgerType) return null;

  const isBank = ledgerType === "BANK";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const newLedger = await createLedger({
        name: name.trim(),
        type: ledgerType as "BANK" | "USER",
        openingBalance: parseFloat(openingBalance) || 0,
        phone: phone || undefined, email: email || undefined, pan: pan || undefined,
        bankName: bankName || undefined, accountNumber: accountNumber || undefined,
        ifscCode: ifscCode || undefined, address: address || undefined,
        sunCode: sunCode || undefined, sunName: sunName || undefined,
      });
      setCreatedLedger(newLedger);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to create ledger");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all";

  if (success && createdLedger) {
    const groupName = createdLedger.group?.name || "—";
    const groupCode = createdLedger.group?.code || "—";

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
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-5xl rounded-2xl p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 bg-emerald-50/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-slate-900">
                  Ledger Created Successfully
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-700 font-bold tracking-wide uppercase mt-0.5">
                  Tally Accounting Master Data
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => {
                onCreated();
                onClose();
              }}
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
              onClick={() => {
                onCreated();
                onClose();
              }}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md", isBank ? "bg-blue-500" : "bg-amber-500")}>
                {isBank ? <Landmark className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {isBank ? "Bank Ledger" : "User Ledger"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Create a new {isBank ? "bank" : "user/client"} ledger account
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4 animate-in zoom-in-50 duration-300">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">Ledger Created!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-xs text-rose-700">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Name <span className="text-rose-500">*</span>
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ledger name" required className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Code
                </label>
                <select
                  value={sunCode}
                  onChange={(e) => setSunCode(e.target.value)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {sunAccounts.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Ledger Name
                </label>
                <input
                  value={sunName}
                  readOnly
                  placeholder="Auto-filled"
                  className={cn(inputClass, "bg-slate-50 text-slate-500 font-semibold cursor-not-allowed")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Opening Balance</label>
                <input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">PAN</label>
                <input type="text" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Phone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
              </div>
            </div>
            {isBank && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Bank Name</label>
                  <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Account No</label>
                  <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">IFSC Code</label>
                  <input type="text" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="IFSC code" className={inputClass} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" rows={2} className={cn(inputClass, "resize-none")} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Create Ledger</>}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}




// ============================================
// GROUP CREATION DIALOG — Tally-style
// ============================================

const UNDER_OPTIONS = [
  "Capital Account",
  "Current Assets",
  "Fixed Assets",
  "Current Liabilities",
  "Bank Accounts",
  "Sales Accounts",
  "Purchase Accounts",
  "Direct Expenses",
  "Indirect Expenses",
  "Direct Income",
  "Indirect Income",
] as const;

const ALLOCATION_OPTIONS = ["Not Applicable", "Quantity", "Value"] as const;

function YesNoToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <p className="text-xs text-slate-700 font-medium leading-relaxed flex-1">{label}</p>
      <div className="flex gap-1 shrink-0">
        {([false, true] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded-lg border transition-all",
              value === v
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [alias, setAlias] = useState("");
  const [under, setUnder] = useState("Capital Account");
  const [isSublLedger, setIsSublLedger] = useState(false);
  const [nettBalance, setNettBalance] = useState(false);
  const [usedForCalc, setUsedForCalc] = useState(false);
  const [allocationMethod, setAllocationMethod] = useState("Not Applicable");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setCode(""); setAlias(""); setUnder("Capital Account");
      setIsSublLedger(false); setNettBalance(false); setUsedForCalc(false);
      setAllocationMethod("Not Applicable");
      setSubmitting(false); setSuccess(false); setCreatedGroup(null); setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (code.trim() && code.trim().length !== 6) {
      setError("Group code must be exactly 6 characters");
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const res = await createGroup({ name, code: code.trim() || undefined, alias: alias || undefined, under, isSublLedger, nettBalance, usedForCalc, allocationMethod });
      setCreatedGroup(res);
      setSuccess(true);
      setTimeout(() => { onCreated?.(); onClose(); }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-none p-0 border border-slate-300 shadow-2xl overflow-hidden">
        {/* Tally-style header bar */}
        <div className="bg-[#1a3a5c] px-5 py-3 flex items-center justify-between">
          <DialogTitle className="text-sm font-bold text-white tracking-wide">Group Creation</DialogTitle>
          <DialogDescription className="sr-only">Create a Tally-style accounting group</DialogDescription>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 bg-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4 animate-in zoom-in-50 duration-300">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-base font-bold text-slate-900">Group Created!</p>
            <p className="text-xs text-slate-500 mt-1">
              {name} ({createdGroup?.code || "Auto-generated"}) has been added under {under}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white">
            {/* Main form area */}
            <div className="px-5 pt-4 pb-2 space-y-0">

              {/* Name — highlighted yellow, Tally-style */}
              <div className="flex items-center border-b border-slate-200 py-2">
                <label className="w-52 shrink-0 text-xs font-semibold text-slate-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter group name"
                  className="flex-1 px-2 py-1 text-sm font-bold bg-[#fffde7] border border-[#e0c84b] rounded focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 transition-all"
                />
              </div>

              {/* Code */}
              <div className="flex items-center border-b border-slate-200 py-2">
                <label className="w-52 shrink-0 text-xs font-semibold text-slate-700">Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="Optional (6 characters)"
                  className="flex-1 px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-slate-300 transition-all font-mono"
                  maxLength={6}
                />
              </div>

              {/* Alias */}
              <div className="flex items-center border-b border-slate-200 py-2">
                <label className="w-52 shrink-0 text-xs text-slate-500">(Alias)</label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Optional alias"
                  className="flex-1 px-2 py-1 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:border-slate-300 transition-all"
                />
              </div>

              {/* Under */}
              <div className="flex items-center border-b border-slate-200 py-2">
                <label className="w-52 shrink-0 text-xs font-semibold text-slate-700">Under</label>
                <select
                  value={under}
                  onChange={(e) => setUnder(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm font-medium bg-white border border-slate-200 rounded focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all cursor-pointer"
                >
                  {UNDER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggles section */}
            <div className="px-5 pt-2 pb-1 border-t border-slate-100 bg-slate-50/60">
              <YesNoToggle
                label="Group behaves like a sub-ledger"
                value={isSublLedger}
                onChange={setIsSublLedger}
              />
              <YesNoToggle
                label="Nett Debit/Credit Balances for Reporting"
                value={nettBalance}
                onChange={setNettBalance}
              />
              <YesNoToggle
                label="Used for calculation (for example: taxes, discounts) (for sales invoice entries)"
                value={usedForCalc}
                onChange={setUsedForCalc}
              />
            </div>

            {/* Method to allocate */}
            <div className="px-5 py-3 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-4">
                <label className="w-52 shrink-0 text-xs font-semibold text-slate-700 leading-tight">
                  Method to allocate when used in purchase invoice
                </label>
                <select
                  value={allocationMethod}
                  onChange={(e) => setAllocationMethod(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm font-medium bg-white border border-slate-200 rounded focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
                >
                  {ALLOCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-5 mb-2 flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-xs text-rose-700">{error}</p>
              </div>
            )}

            {/* Tally-style footer action bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#f0f0e8] border-t border-slate-300">
              <p className="text-[10px] text-slate-500 font-mono">Accept: <kbd className="bg-white border border-slate-300 px-1 rounded text-[9px]">Enter</kbd></p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 rounded border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-1.5 text-xs font-bold text-white rounded bg-[#1a3a5c] hover:bg-[#16324f] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {submitting ? "Saving..." : "Accept"}
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// VOUCHER CREATION DIALOG
// ============================================

const VOUCHER_TYPE_MAP: Record<string, { label: string; icon: any; color: string; apiType: string }> = {
  SALE: { label: "Sale Voucher", icon: ShoppingCart, color: "bg-emerald-500", apiType: "PAYMENT_SALES" },
  PAYMENT: { label: "Payment Voucher", icon: FileCheck, color: "bg-blue-500", apiType: "PAYMENT_SALES" },
  RECEIPT: { label: "Receipt Voucher", icon: Receipt, color: "bg-cyan-500", apiType: "RECEIPT" },
  JOURNAL: { label: "Journal Voucher", icon: BookOpen, color: "bg-violet-500", apiType: "JOURNAL" },
  PURCHASE: { label: "Purchases Voucher", icon: ShoppingBag, color: "bg-amber-500", apiType: "RECEIPT" },
};

// Payment & Receipt voucher uses these fields
const PAYMENT_RECEIPT_TYPES = ["PAYMENT", "RECEIPT"];
const PAYMENT_MODES = ["Cash", "Cheque", "NEFT", "RTGS", "IMPS", "UPI", "DD", "Online Transfer", "Other"];

// Universal entry row — superset of all fields
interface VoucherEntryRow {
  ledgerId: string;
  ledgerCode: string;
  narration: string;
  // Sale / Journal / Purchase fields
  contractNoteNo: string;
  contractNoteDate: string;
  scriptName: string;
  isin: string;
  qty: string;
  rate: string;
  amount: string;
  subLedgerCode: string;
  subLedgerName: string;
  // Payment / Receipt fields
  orderId: string;
  orderDate: string;
  modeOfPayment: string;
  instrumentId: string;
  instrumentDate: string;
  bankValueDate: string;
  // Common
  debit: string;
  credit: string;
}

const EMPTY_ENTRY: VoucherEntryRow = {
  ledgerId: "", ledgerCode: "", narration: "",
  contractNoteNo: "", contractNoteDate: "", scriptName: "", isin: "",
  qty: "", rate: "", amount: "", subLedgerCode: "", subLedgerName: "",
  orderId: "", orderDate: "", modeOfPayment: "", instrumentId: "",
  instrumentDate: "", bankValueDate: "",
  debit: "", credit: "",
};

function CreateVoucherDialog({
  open,
  onClose,
  voucherType,
  ledgers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  voucherType: string | null;
  ledgers: Ledger[];
  onCreated: () => void;
}) {
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0] ?? "");
  const [voucherNo, setVoucherNo] = useState("");
  const [entries, setEntries] = useState<VoucherEntryRow[]>([{ ...EMPTY_ENTRY }, { ...EMPTY_ENTRY }]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaymentReceipt = voucherType ? PAYMENT_RECEIPT_TYPES.includes(voucherType) : false;

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0] ?? "");
      setVoucherNo("");
      setEntries([{ ...EMPTY_ENTRY }, { ...EMPTY_ENTRY }]);
      setSubmitting(false);
      setSuccess(false);
      setError(null);
    }
  }, [open, voucherType]);

  if (!voucherType || !VOUCHER_TYPE_MAP[voucherType]) return null;

  const config = VOUCHER_TYPE_MAP[voucherType];
  const IconComp = config.icon;

  const totalDebit = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addEntry = () => {
    setEntries((prev) => [...prev, { ...EMPTY_ENTRY }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 2) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof VoucherEntryRow, value: string) => {
    setEntries((prev) => {
      const updated = prev.map((e, i) => (i === index ? { ...e, [field]: value } : e));
      const entry = updated[index];
      if (!entry) return updated;

      if (field === "ledgerId" && value) {
        const ledger = ledgers.find((l) => l.id === value);
        if (ledger) entry.ledgerCode = ledger.code || "";
      }

      if (!isPaymentReceipt && (field === "qty" || field === "rate")) {
        const qty = parseFloat(entry.qty) || 0;
        const rate = parseFloat(entry.rate) || 0;
        if (qty > 0 && rate > 0) entry.amount = (qty * rate).toFixed(2);
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) { setError("Total Debits must equal Total Credits"); return; }

    const validEntries = entries.filter((e) => e.ledgerId && (parseFloat(e.debit) > 0 || parseFloat(e.credit) > 0));
    if (validEntries.length < 2) { setError("At least 2 valid entries are required"); return; }

    if (voucherType === "SALE" || voucherType === "PURCHASE") {
      const hasStockDetails = validEntries.some(e => e.scriptName && e.isin);
      if (!hasStockDetails) {
        setError("Script Name and ISIN are required for Stock Vouchers");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      await createVoucher({
        type: config.apiType,
        date,
        narration: validEntries[0]?.narration || "",
        referenceNumber: voucherNo || "",
        entries: validEntries.map((e) => ({
          ledgerId: e.ledgerId,
          entryType: (parseFloat(e.debit) > 0 ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
          amount: parseFloat(e.debit) > 0 ? parseFloat(e.debit) : parseFloat(e.credit),
          narration: e.narration || undefined,
          scriptName: e.scriptName || undefined,
          isin: e.isin || undefined,
          qty: e.qty ? parseFloat(e.qty) : undefined,
          rate: e.rate ? parseFloat(e.rate) : undefined,
          remarks: isPaymentReceipt
            ? [e.orderId && `Order:${e.orderId}`, e.modeOfPayment && `Mode:${e.modeOfPayment}`, e.instrumentId && `Inst:${e.instrumentId}`].filter(Boolean).join("; ") || undefined
            : e.contractNoteNo ? `CN: ${e.contractNoteNo}` : undefined,
        })),
        metadata: {
          voucherNo,
          voucherClass: voucherType,
          ...(isPaymentReceipt
            ? {
                paymentDetails: validEntries.map((e) => ({
                  orderId: e.orderId, orderDate: e.orderDate,
                  modeOfPayment: e.modeOfPayment, instrumentId: e.instrumentId,
                  instrumentDate: e.instrumentDate, bankValueDate: e.bankValueDate,
                })),
              }
            : {
                contractNotes: validEntries.filter((e) => e.contractNoteNo).map((e) => ({ no: e.contractNoteNo, date: e.contractNoteDate })),
                subLedgers: validEntries.filter((e) => e.subLedgerCode).map((e) => ({ code: e.subLedgerCode, name: e.subLedgerName })),
              }),
        },
      });

      setSuccess(true);
      setTimeout(() => { onCreated(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100 outline-none transition-all";
  const monoInputClass = inputClass + " font-mono";

  // Column definitions based on voucher type
  const paymentReceiptCols = [
    { label: "#", w: "w-[36px]" },
    { label: "Ledger Code", w: "w-[100px]" },
    { label: "Ledger Name", w: "w-[160px]" },
    { label: "Narration", w: "w-[150px]" },
    { label: "Order ID", w: "w-[110px]" },
    { label: "Order Date", w: "w-[110px]" },
    { label: "Mode Of Payment", w: "w-[130px]" },
    { label: "Instrument ID", w: "w-[110px]" },
    { label: "Instrument Date", w: "w-[110px]" },
    { label: "Bank Value Date", w: "w-[110px]" },
    { label: "Debit", w: "w-[85px]" },
    { label: "Credit", w: "w-[85px]" },
    { label: "", w: "w-[36px]" },
  ];

  const tradingCols = [
    { label: "#", w: "w-[36px]" },
    { label: "Ledger Code", w: "w-[100px]" },
    { label: "Ledger Name", w: "w-[160px]" },
    { label: "Narration", w: "w-[140px]" },
    { label: "Contract Note / Sale Advice No", w: "w-[140px]" },
    { label: "Contract / Sale Advice Date", w: "w-[110px]" },
    { label: "Script Name", w: "w-[120px]" },
    { label: "ISIN", w: "w-[100px]" },
    { label: "Qty", w: "w-[65px]" },
    { label: "Rate", w: "w-[75px]" },
    { label: "Amount", w: "w-[85px]" },
    { label: "Debit", w: "w-[85px]" },
    { label: "Credit", w: "w-[85px]" },
    { label: "Sub Ledger Code", w: "w-[100px]" },
    { label: "Sub Ledger Name", w: "w-[120px]" },
    { label: "", w: "w-[36px]" },
  ];

  const columns = isPaymentReceipt ? paymentReceiptCols : tradingCols;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[95vw] lg:max-w-[1300px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md", config.color)}>
                <IconComp className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{config.label}</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Create a new {config.label.toLowerCase()} entry
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4 animate-in zoom-in-50 duration-300">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">Voucher Created!</p>
            <p className="text-sm text-slate-500 mt-1">{config.label} has been created successfully</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            {error && (
              <div className="mx-6 mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-xs text-rose-700">{error}</p>
              </div>
            )}

            {/* Top fields: Date + Voucher No + Voucher Type */}
            <div className="px-6 pt-4 pb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker value={date} onChange={(val) => setDate(val)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Voucher No</label>
                <div className={cn(inputClass, "bg-slate-50 text-slate-400 font-mono text-xs flex items-center gap-1.5 cursor-default select-none")}>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">AUTO</span>
                  Generated on save
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Voucher Type</label>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50", config.color.replace("bg-", "text-").replace("500", "700"))}>
                  <IconComp className="h-3.5 w-3.5" /> {config.label}
                </div>
              </div>
            </div>

            {/* Entries Table Header */}
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Entry Lines</label>
                <button type="button" onClick={addEntry} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>
            </div>

            {/* Scrollable Entry Table */}
            <div className="flex-1 overflow-auto px-6 pb-3 max-h-[40vh]">
              <table className="w-full text-xs border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-100/80">
                    {columns.map((col, ci) => (
                      <th key={col.label || `act-${ci}`} className={cn("px-1.5 py-2 text-[9px] font-extrabold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap border-b border-slate-200", col.w)}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {/* # */}
                      <td className="px-1.5 py-1.5 text-center font-bold text-slate-400">{index + 1}</td>

                      {/* Ledger Code */}
                      <td className="px-1 py-1.5">
                        <input type="text" value={entry.ledgerCode} readOnly className={cn(monoInputClass, "bg-slate-50 text-emerald-700 font-bold cursor-default")} placeholder="—" />
                      </td>

                      {/* Ledger Name */}
                      <td className="px-1 py-1.5">
                        <select value={entry.ledgerId} onChange={(e) => updateEntry(index, "ledgerId", e.target.value)} className={cn(inputClass, "min-w-[140px]")}>
                          <option value="">Select Ledger</option>
                          {ledgers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                        </select>
                      </td>

                      {/* Narration */}
                      <td className="px-1 py-1.5">
                        <input type="text" placeholder="Narration" value={entry.narration} onChange={(e) => updateEntry(index, "narration", e.target.value)} className={inputClass} />
                      </td>

                      {isPaymentReceipt ? (
                        <>
                          {/* Order ID */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="Order ID" value={entry.orderId} onChange={(e) => updateEntry(index, "orderId", e.target.value)} className={inputClass} />
                          </td>
                          {/* Order Date */}
                          <td className="px-1 py-1.5">
                            <DatePicker value={entry.orderDate} onChange={(val) => updateEntry(index, "orderDate", val)} className={inputClass} />
                          </td>
                          {/* Mode Of Payment */}
                          <td className="px-1 py-1.5">
                            <select value={entry.modeOfPayment} onChange={(e) => updateEntry(index, "modeOfPayment", e.target.value)} className={inputClass}>
                              <option value="">Select</option>
                              {PAYMENT_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
                            </select>
                          </td>
                          {/* Instrument ID */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="Inst ID" value={entry.instrumentId} onChange={(e) => updateEntry(index, "instrumentId", e.target.value)} className={monoInputClass} />
                          </td>
                          {/* Instrument Date */}
                          <td className="px-1 py-1.5">
                            <DatePicker value={entry.instrumentDate} onChange={(val) => updateEntry(index, "instrumentDate", val)} className={inputClass} />
                          </td>
                          {/* Bank Value Date */}
                          <td className="px-1 py-1.5">
                            <DatePicker value={entry.bankValueDate} onChange={(val) => updateEntry(index, "bankValueDate", val)} className={inputClass} />
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Contract Note No */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="CN No" value={entry.contractNoteNo} onChange={(e) => updateEntry(index, "contractNoteNo", e.target.value)} className={inputClass} />
                          </td>
                          {/* Contract Note Date */}
                          <td className="px-1 py-1.5">
                            <DatePicker value={entry.contractNoteDate} onChange={(val) => updateEntry(index, "contractNoteDate", val)} className={inputClass} />
                          </td>
                          {/* Script Name */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="Script" value={entry.scriptName} onChange={(e) => updateEntry(index, "scriptName", e.target.value)} className={inputClass} />
                          </td>
                          {/* ISIN */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="ISIN" value={entry.isin} onChange={(e) => updateEntry(index, "isin", e.target.value)} className={monoInputClass} />
                          </td>
                          {/* Qty */}
                          <td className="px-1 py-1.5">
                            <input type="number" placeholder="0" min="0" value={entry.qty} onChange={(e) => updateEntry(index, "qty", e.target.value)} className={cn(monoInputClass, "text-right")} />
                          </td>
                          {/* Rate */}
                          <td className="px-1 py-1.5">
                            <input type="number" placeholder="0.00" step="0.01" min="0" value={entry.rate} onChange={(e) => updateEntry(index, "rate", e.target.value)} className={cn(monoInputClass, "text-right")} />
                          </td>
                          {/* Amount */}
                          <td className="px-1 py-1.5">
                            <input type="number" placeholder="0.00" step="0.01" value={entry.amount} onChange={(e) => updateEntry(index, "amount", e.target.value)} className={cn(monoInputClass, "text-right bg-slate-50/50")} />
                          </td>
                        </>
                      )}

                      {/* Debit */}
                      <td className="px-1 py-1.5">
                        <input type="number" placeholder="0.00" step="0.01" min="0" value={entry.debit} onChange={(e) => updateEntry(index, "debit", e.target.value)} className={cn(monoInputClass, "text-right text-rose-700")} />
                      </td>
                      {/* Credit */}
                      <td className="px-1 py-1.5">
                        <input type="number" placeholder="0.00" step="0.01" min="0" value={entry.credit} onChange={(e) => updateEntry(index, "credit", e.target.value)} className={cn(monoInputClass, "text-right text-teal-700")} />
                      </td>

                      {!isPaymentReceipt && (
                        <>
                          {/* Sub Ledger Code */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="Sub Code" value={entry.subLedgerCode} onChange={(e) => updateEntry(index, "subLedgerCode", e.target.value)} className={monoInputClass} />
                          </td>
                          {/* Sub Ledger Name */}
                          <td className="px-1 py-1.5">
                            <input type="text" placeholder="Sub Ledger" value={entry.subLedgerName} onChange={(e) => updateEntry(index, "subLedgerName", e.target.value)} className={inputClass} />
                          </td>
                        </>
                      )}

                      {/* Remove */}
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeEntry(index)} disabled={entries.length <= 2} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed mx-auto">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200/50">
                <div className="flex items-center gap-5 text-xs">
                  <span className="font-semibold text-slate-600">Total Debit: <span className="text-rose-600 font-bold font-mono">₹{totalDebit.toFixed(2)}</span></span>
                  <span className="font-semibold text-slate-600">Total Credit: <span className="text-teal-600 font-bold font-mono">₹{totalCredit.toFixed(2)}</span></span>
                </div>
                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-md", isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                  {isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !isBalanced} className="flex-1 py-2.5 px-4 text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>) : (<><Plus className="h-4 w-4" /> Create Voucher</>)}
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================

export default function AccountingDashboard() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLedgers();
      setLedgers(res.ledgers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for postMessage from popup windows to refresh data
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "LEDGER_CREATED" || e.data?.type === "VOUCHER_CREATED" || e.data?.type === "LEDGER_UPDATED") {
        loadData();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [loadData]);

  // Summary stats
  const stats = useMemo(() => {
    const totalLedgers = ledgers.length;
    const bankLedgers = ledgers.filter((l) => l.type === "BANK").length;
    const userLedgers = ledgers.filter((l) => l.type === "USER").length;
    const totalBalance = ledgers.reduce((s, l) => s + (l.currentBalance || 0), 0);
    return { totalLedgers, bankLedgers, userLedgers, totalBalance };
  }, [ledgers]);

  const ledgersMissingGroup = useMemo(() => {
    return ledgers.filter((l) => l.type === "USER" && !l.groupId && l.isActive);
  }, [ledgers]);

  const ledgersMissingSunCode = useMemo(() => {
    return ledgers.filter((l) => l.type === "USER" && (!l.sunCode || !l.sunName) && l.isActive);
  }, [ledgers]);

  // Quick links
  const quickLinks = [
    { title: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: BookOpen, description: "Manage your ledger accounts", color: "text-emerald-600" },
    { title: "Day Book", href: "/accounting/day-book", icon: CalendarDays, description: "View daily transactions", color: "text-blue-600" },
    { title: "Trial Balance", href: "/accounting/trial-balance", icon: Scale, description: "Check debit/credit balance", color: "text-violet-600" },
    { title: "Invoices", href: "/accounting/invoices", icon: FileText, description: "Manage invoices", color: "text-amber-600" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Accounting Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Overview of your accounting system</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* ── Missing Group Warning Alert ── */}
      {ledgersMissingGroup.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 mt-0.5">
            <AlertCircle className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-amber-950">Party Ledgers Missing Group Classification</p>
            <p className="text-xs text-amber-800 mt-1 font-medium leading-relaxed">
              There are <strong className="font-extrabold">{ledgersMissingGroup.length}</strong> active client/user ledger account(s) that do not have an accounting group assigned (meaning the <strong className="font-extrabold">Trade Receivable</strong> group was not found when they were created). Please go to the Chart of Accounts to resolve them.
            </p>
            <div className="mt-3">
              <Link href="/accounting/chart-of-accounts" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-950 text-white hover:bg-amber-900 shadow-sm transition-all">
                Go to Chart of Accounts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Missing Sun Code Warning Alert ── */}
      {ledgersMissingSunCode.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 mt-0.5">
            <AlertCircle className="h-5 w-5 text-rose-700" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-rose-950">Party Ledgers Missing Sun Code Classification</p>
            <p className="text-xs text-rose-800 mt-1 font-medium leading-relaxed">
              There are <strong className="font-extrabold">{ledgersMissingSunCode.length}</strong> active client/user ledger account(s) that do not have a Sun Code/Name assigned (which should default to <strong className="font-extrabold">AF030101RP</strong> / <strong className="font-extrabold">Trade Receivable (Retail Platform)</strong>). Please go to the Chart of Accounts to resolve them.
            </p>
            <div className="mt-3">
              <Link href="/accounting/chart-of-accounts" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-950 text-white hover:bg-rose-900 shadow-sm transition-all">
                Go to Chart of Accounts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Ledgers", value: stats.totalLedgers, icon: BookOpen, color: "bg-emerald-50 text-emerald-600", border: "border-emerald-100" },
          { label: "Bank Ledgers", value: stats.bankLedgers, icon: Landmark, color: "bg-blue-50 text-blue-600", border: "border-blue-100" },
          { label: "User Ledgers", value: stats.userLedgers, icon: Users, color: "bg-amber-50 text-amber-600", border: "border-amber-100" },
          { label: "Net Balance", value: `₹${Math.abs(stats.totalBalance).toFixed(2)}`, icon: Wallet, color: stats.totalBalance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600", border: stats.totalBalance >= 0 ? "border-emerald-100" : "border-rose-100" },
        ].map((s) => (
          <Card key={s.label} className={cn("p-5 rounded-2xl shadow-sm border", s.border)}>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      {quickLinks.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 group-hover:bg-emerald-50 transition-colors">
                      <link.icon className={cn("h-5 w-5", link.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">{link.title}</p>
                        <ArrowRight className={cn("h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1", link.color)} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{link.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}