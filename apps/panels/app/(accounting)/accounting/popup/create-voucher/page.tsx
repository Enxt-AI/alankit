"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  FileCheck,
  Receipt,
  BookOpen,
  ShoppingBag,
  Loader2,
  Check,
  AlertCircle,
  Users,
  Building2,
  TrendingUp,
  Plus,
  X,
  ArrowRight,
  ArrowLeftRight,
  FileMinus,
  FilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { fetchLedgers, createVoucher, type Ledger } from "@/lib/accounting-api";

// ── Voucher type config ────────────────────────────────────────────────────────
const VOUCHER_CONFIG: Record<string, {
  label: string;
  icon: any;
  gradient: string;
  apiType: string;
  description: string;
}> = {
  SALE:        { label: "Sale Voucher",       icon: ShoppingCart,   gradient: "from-emerald-500 to-emerald-700", apiType: "PAYMENT_SALES",  description: "Customer invoice & share delivery" },
  PURCHASE:    { label: "Purchase Voucher",   icon: ShoppingBag,    gradient: "from-amber-500 to-orange-600",   apiType: "RECEIPT",        description: "Vendor invoice & share acquisition" },
  PAYMENT:     { label: "Payment Voucher",    icon: FileCheck,      gradient: "from-blue-500 to-blue-700",       apiType: "PAYMENT_SALES",  description: "Money paid out from Bank/Cash" },
  RECEIPT:     { label: "Receipt Voucher",    icon: Receipt,        gradient: "from-indigo-500 to-indigo-700",   apiType: "RECEIPT",        description: "Money received into Bank/Cash" },
  CONTRA:      { label: "Contra Voucher",     icon: ArrowLeftRight, gradient: "from-purple-500 to-purple-700",   apiType: "JOURNAL",        description: "Bank to Cash / Bank to Bank transfer" },
  JOURNAL:     { label: "Journal Voucher",    icon: BookOpen,       gradient: "from-violet-500 to-violet-700",   apiType: "JOURNAL",        description: "Adjustments, provisions, depreciation" },
  DEBIT_NOTE:  { label: "Debit Note",         icon: FileMinus,      gradient: "from-orange-500 to-amber-700",   apiType: "DEBIT_NOTE",     description: "Purchase return / debit adjustment" },
  CREDIT_NOTE: { label: "Credit Note",        icon: FilePlus,       gradient: "from-cyan-500 to-blue-700",       apiType: "CREDIT_NOTE",    description: "Sales return / credit adjustment" },
};

const PAYMENT_MODES = ["Cash","Cheque","NEFT","RTGS","IMPS","UPI","DD","Online Transfer","Other"];

// ── Smart‐wired voucher types ─────────────────────────────────────────────────
const SMART_TYPES: string[] = ["SALE", "PURCHASE"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

// ── Manual entry row ──────────────────────────────────────────────────────────
interface ManualRow {
  ledgerId: string;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  narration: string;
  scriptName: string;
  isin: string;
  qty: string;
  rate: string;
  remarks: string;
}
const EMPTY_ROW: ManualRow = {
  ledgerId: "", entryType: "DEBIT", amount: "", narration: "",
  scriptName: "", isin: "", qty: "", rate: "", remarks: "",
};

export default function CreateVoucherPopup() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") || "PAYMENT";
  const voucherType = VOUCHER_CONFIG[initialType] ? initialType : "PAYMENT";
  const config = (VOUCHER_CONFIG[voucherType] ?? VOUCHER_CONFIG.PAYMENT)!;
  const IconComp = config.icon;
  const isSmart = SMART_TYPES.includes(voucherType);

  // ── State ──────────────────────────────────────────────────────────────────
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [narration, setNarration] = useState("");
  const [refNo, setRefNo] = useState("");
  const [refDate, setRefDate] = useState("");

  // Smart-voucher fields
  const [clientLedgerId, setClientLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [scriptName, setScriptName] = useState("");
  const [isin, setIsin] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [bankValueDate, setBankValueDate] = useState("");
  const [cnNo, setCnNo] = useState("");
  const [cnDate, setCnDate] = useState("");

  // Manual-voucher fields
  const [rows, setRows] = useState<ManualRow[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW, entryType: "CREDIT" }]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load ledgers ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLedgers().then((r) => setLedgers(r.ledgers || [])).catch(() => {});
  }, []);

  // ── Derived ledger shortcuts ────────────────────────────────────────────────
  const saleLedger  = useMemo(() => ledgers.find((l) => l.type === "SALE"), [ledgers]);
  const bankLedger = useMemo(
    () =>
      ledgers.find(
        (l) => l.type === "BANK" && l.name.toUpperCase().includes("CASHFREE"),
      ) ||
      ledgers.find(
        (l) => l.type === "BANK" && !l.name.toUpperCase().includes("HDFC"),
      ) ||
      ledgers.find((l) => l.type === "BANK"),
    [ledgers],
  );
  const userLedgers = useMemo(() => ledgers.filter((l) => l.type === "USER"), [ledgers]);
  const clientLedger = useMemo(() => ledgers.find((l) => l.id === clientLedgerId), [ledgers, clientLedgerId]);

  // Computed amount for SALE voucher (qty × rate)
  const computedAmount = useMemo(() => {
    if (voucherType !== "SALE") return parseFloat(amount) || 0;
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    if (q > 0 && r > 0) return parseFloat((q * r).toFixed(2));
    return parseFloat(amount) || 0;
  }, [voucherType, qty, rate, amount]);

  // Manual totals
  const manualDebit  = rows.reduce((s, r) => s + (r.entryType === "DEBIT"  ? parseFloat(r.amount) || 0 : 0), 0);
  const manualCredit = rows.reduce((s, r) => s + (r.entryType === "CREDIT" ? parseFloat(r.amount) || 0 : 0), 0);
  const isManualBalanced = Math.abs(manualDebit - manualCredit) < 0.01 && manualDebit > 0;

  // ── Double-entry preview (for smart vouchers) ───────────────────────────────
  const doubleEntry = useMemo(() => {
    if (!isSmart) return [];
    const amt = computedAmount;
    if (voucherType === "SALE") {
      return [
        { ledger: clientLedger?.name || "Client Ledger", code: clientLedger?.code || "—", side: "Dr", amount: amt, color: "text-rose-600" },
        { ledger: saleLedger?.name  || "Sales A/C",      code: saleLedger?.code  || "—", side: "Cr", amount: amt, color: "text-emerald-600" },
      ];
    }
    if (voucherType === "PURCHASE") {
      const purLedger = ledgers.find((l) => l.type === "PURCHASE") || { name: "Purchase A/C", code: "—" };
      return [
        { ledger: purLedger.name,                          code: purLedger.code,             side: "Dr", amount: amt, color: "text-rose-600" },
        { ledger: clientLedger?.name || "Client Ledger", code: clientLedger?.code || "—", side: "Cr", amount: amt, color: "text-emerald-600" },
      ];
    }
    // RECEIPT
    return [
      { ledger: bankLedger?.name  || "Bank A/C",     code: bankLedger?.code  || "—", side: "Dr", amount: amt, color: "text-rose-600" },
      { ledger: clientLedger?.name || "Client Ledger", code: clientLedger?.code || "—",      side: "Cr", amount: amt, color: "text-emerald-600" },
    ];
  }, [isSmart, voucherType, computedAmount, clientLedger, saleLedger, bankLedger, ledgers]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let entries: any[];

    if (isSmart) {
      if (!clientLedgerId) { setError("Please select the Client Ledger"); return; }
      const amt = computedAmount;
      if (amt <= 0) { setError("Amount must be greater than 0"); return; }

      const counterLedgerId = voucherType === "SALE" ? saleLedger?.id : bankLedger?.id;
      if (!counterLedgerId) { setError("System ledger not found. Please refresh."); return; }

      const sharedPayload = {
        narration: narration || undefined,
        scriptName: scriptName || undefined,
        isin: isin || undefined,
        qty: qty ? parseFloat(qty) : undefined,
        rate: rate ? parseFloat(rate) : undefined,
      };

      if (voucherType === "SALE" || voucherType === "PURCHASE") {
        let debitLedger = clientLedgerId;
        let creditLedger = saleLedger?.id;
        
        if (voucherType === "PURCHASE") {
          const purLedger = ledgers.find((l) => l.type === "PURCHASE");
          debitLedger = purLedger?.id || "";
          creditLedger = clientLedgerId;
        }

        if (!debitLedger || !creditLedger) {
          setError(`System Control Ledgers missing for ${voucherType}`);
          return;
        }

        entries = [
          { ledgerId: debitLedger, entryType: "DEBIT", amount: amt, ...sharedPayload,
            remarks: cnNo ? `CN: ${cnNo}` : undefined,
            metadata: { cnNo, cnDate } },
          { ledgerId: creditLedger, entryType: "CREDIT", amount: amt, ...sharedPayload,
            narration: narration || undefined },
        ];
      } else {
        // RECEIPT: Dr Bank, Cr Client
        entries = [
          { ledgerId: counterLedgerId, entryType: "DEBIT",  amount: amt, ...sharedPayload,
            narration: narration || undefined,
            remarks: [modeOfPayment && `Mode:${modeOfPayment}`, instrumentId && `Inst:${instrumentId}`].filter(Boolean).join("; ") || undefined },
          { ledgerId: clientLedgerId, entryType: "CREDIT", amount: amt, ...sharedPayload,
            narration: narration || undefined },
        ];
      }
    } else {
      // Manual mode
      if (!isManualBalanced) { setError("Total Debits must equal Total Credits"); return; }
      const valid = rows.filter((r) => r.ledgerId && parseFloat(r.amount) > 0);
      if (valid.length < 2) { setError("At least 2 valid entries required"); return; }
      entries = valid.map((r) => ({
        ledgerId: r.ledgerId,
        entryType: r.entryType,
        amount: parseFloat(r.amount),
        narration: r.narration || undefined,
        scriptName: r.scriptName || undefined,
        isin: r.isin || undefined,
        qty: r.qty ? parseFloat(r.qty) : undefined,
        rate: r.rate ? parseFloat(r.rate) : undefined,
        remarks: r.remarks || undefined,
      }));
    }

    setSubmitting(true);
    try {
      const firstStockEntry = entries.find((e) => (e.qty && e.qty > 0) || e.isin || e.scriptName);
      const stockMeta = firstStockEntry
        ? {
            scriptName: firstStockEntry.scriptName,
            stockName: firstStockEntry.scriptName,
            isin: firstStockEntry.isin,
            qty: firstStockEntry.qty,
            quantity: firstStockEntry.qty,
            rate: firstStockEntry.rate,
            pricePerShare: firstStockEntry.rate,
          }
        : {};

      await createVoucher({
        type: config.apiType,
        date,
        narration: narration || "",
        referenceNumber: refNo || undefined,
        referenceDate: refDate || undefined,
        entries,
        metadata: { refNo, voucherClass: voucherType, ...stockMeta },
      });
      setSuccess(true);
      window.opener?.postMessage({ type: "VOUCHER_CREATED" }, "*");
      setTimeout(() => window.close(), 1400);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 animate-in zoom-in-50 duration-300">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">Voucher Created!</p>
          <p className="text-sm text-slate-500">Entries posted to ledgers. Window closing…</p>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all";
  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", config.gradient)}>
            <IconComp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{config.label}</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{config.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6 w-full space-y-5">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-50 border border-rose-200">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700 font-semibold">{error}</p>
          </div>
        )}

        {/* ── Common header fields ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">Voucher Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Date <span className="text-rose-500">*</span></label>
              <DatePicker value={date} onChange={(val) => setDate(val)} className={inputCls} />
            </div>
            {(voucherType === "PURCHASE" || voucherType === "SALE") ? (
              <>
                <div>
                  <label className={labelCls}>Contract Note No</label>
                  <input type="text" placeholder="Contract Note No" value={refNo} onChange={(e) => setRefNo(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Contract Note Date</label>
                  <DatePicker value={refDate} onChange={(val) => setRefDate(val)} className={inputCls} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Reference No</label>
                  <input type="text" placeholder="Reference Number" value={refNo} onChange={(e) => setRefNo(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Reference Date</label>
                  <DatePicker value={refDate} onChange={(val) => setRefDate(val)} className={inputCls} />
                </div>
              </>
            )}
            <div className="col-span-3">
              <label className={labelCls}>Narration</label>
              <input type="text" placeholder="Description of this transaction…" value={narration} onChange={(e) => setNarration(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SMART VOUCHER (SALE / RECEIPT)
        ══════════════════════════════════════════════════════════════════ */}
        {isSmart && (
          <>
            {/* Client selection */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">
                {voucherType === "SALE" ? "Sale Details" : "Receipt Details"}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Client Ledger */}
                <div className="col-span-2 md:col-span-1">
                  <label className={labelCls}>
                    <Users className="inline h-3 w-3 mr-1" />
                    Client Ledger <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={clientLedgerId}
                    onChange={(e) => setClientLedgerId(e.target.value)}
                    required
                    className={cn(inputCls, "font-medium")}
                  >
                    <option value="">— Select Client —</option>
                    {userLedgers.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                    ))}
                  </select>
                </div>

                {/* Amount (or qty × rate for SALE) */}
                {voucherType === "SALE" || voucherType === "PURCHASE" ? (
                  <>
                    <div>
                      <label className={labelCls}>Script Name <span className="text-rose-500">*</span></label>
                      <input type="text" placeholder="HDFC Bank Ltd." value={scriptName} onChange={(e) => setScriptName(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ISIN <span className="text-rose-500">*</span></label>
                      <input type="text" placeholder="INE040A01034" value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase())} required className={cn(inputCls, "font-mono uppercase")} />
                    </div>
                    <div>
                      <label className={labelCls}>Contract Note No</label>
                      <input type="text" value={cnNo} onChange={(e) => setCnNo(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>CN Date</label>
                      <DatePicker value={cnDate} onChange={(val) => setCnDate(val)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Qty <span className="text-rose-500">*</span></label>
                      <input type="number" min="0" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} required className={cn(inputCls, "text-right font-mono")} />
                    </div>
                    <div>
                      <label className={labelCls}>Rate (₹) <span className="text-rose-500">*</span></label>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={rate} onChange={(e) => setRate(e.target.value)} required className={cn(inputCls, "text-right font-mono")} />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className={labelCls}>Amount (₹) <span className="normal-case font-medium text-slate-400 text-[10px]">auto from qty × rate</span></label>
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        value={qty && rate ? computedAmount.toFixed(2) : amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={cn(inputCls, "text-right font-bold font-mono text-emerald-700 bg-emerald-50")}
                      />
                    </div>
                  </>
                ) : (
                  // RECEIPT
                  <>
                    <div>
                      <label className={labelCls}>Amount (₹) <span className="text-rose-500">*</span></label>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required className={cn(inputCls, "text-right font-bold font-mono text-emerald-700 bg-emerald-50")} />
                    </div>
                    <div>
                      <label className={labelCls}>Mode of Payment</label>
                      <select value={modeOfPayment} onChange={(e) => setModeOfPayment(e.target.value)} className={inputCls}>
                        <option value="">— Select Mode —</option>
                        {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Instrument / Cheque No</label>
                      <input type="text" placeholder="CHQ123456" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)} className={cn(inputCls, "font-mono")} />
                    </div>
                    <div>
                      <label className={labelCls}>Instrument Date</label>
                      <DatePicker value={instrumentDate} onChange={(val) => setInstrumentDate(val)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Bank Value Date</label>
                      <DatePicker value={bankValueDate} onChange={(val) => setBankValueDate(val)} className={inputCls} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Double-entry preview ─────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-lg">
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">
                Double-Entry Preview
              </h2>
              <div className="space-y-2.5">
                {doubleEntry.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold", row.side === "Dr" ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300")}>
                      {row.side}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{row.ledger}</p>
                      <p className="text-[10px] font-mono text-slate-500">{row.code}</p>
                    </div>
                    <p className={cn("text-base font-extrabold font-mono", row.color)}>
                      ₹{fmt(row.amount)}
                    </p>
                    {i === 0 && (
                      <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {computedAmount > 0 && (
                <div className="flex items-center justify-between mt-4 px-4 py-2 rounded-xl bg-white/5">
                  <span className="text-xs text-slate-400 font-semibold">Total</span>
                  <span className="text-lg font-extrabold text-white font-mono">₹{fmt(computedAmount)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MANUAL VOUCHER (PAYMENT / PURCHASE / JOURNAL)
        ══════════════════════════════════════════════════════════════════ */}
        {!isSmart && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Entry Lines</h2>
              <button type="button" onClick={() => setRows((p) => [...p, { ...EMPTY_ROW }])} className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["#","Ledger","Dr / Cr","Amount (₹)","Narration","Script","ISIN","Qty","Rate","Remarks",""].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-500 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-2 py-2.5">
                        <select value={row.ledgerId} onChange={(e) => setRows((p) => p.map((r, i) => i === idx ? { ...r, ledgerId: e.target.value } : r))} className="w-40 px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-emerald-300">
                          <option value="">Select…</option>
                          {ledgers
                            .filter(
                              (l) =>
                                voucherType === "CONTRA" ||
                                !(
                                  l.type === "BANK" &&
                                  l.name.toUpperCase().includes("HDFC")
                                ),
                            )
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <select value={row.entryType} onChange={(e) => setRows((p) => p.map((r, i) => i === idx ? { ...r, entryType: e.target.value as any } : r))} className={cn("px-2 py-1.5 text-xs rounded-lg border border-slate-200 font-bold outline-none", row.entryType === "DEBIT" ? "text-rose-700 bg-rose-50 border-rose-200" : "text-emerald-700 bg-emerald-50 border-emerald-200")}>
                          <option value="DEBIT">Dr</option>
                          <option value="CREDIT">Cr</option>
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={row.amount} onChange={(e) => setRows((p) => p.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} className="w-28 px-2 py-1.5 text-xs rounded-lg border border-slate-200 font-mono text-right outline-none focus:border-emerald-300 bg-white" />
                      </td>
                      {["narration","scriptName","isin","qty","rate","remarks"].map((field) => (
                        <td key={field} className="px-2 py-2.5">
                          <input
                            type={["qty","rate"].includes(field) ? "number" : "text"}
                            placeholder={field}
                            value={(row as any)[field]}
                            onChange={(e) => setRows((p) => p.map((r, i) => i === idx ? { ...r, [field]: e.target.value } : r))}
                            className="w-24 px-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-emerald-300 bg-white"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center">
                        <button type="button" onClick={() => setRows((p) => p.filter((_, i) => i !== idx))} disabled={rows.length <= 2} className="h-6 w-6 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 disabled:opacity-20 flex items-center justify-center mx-auto">
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Balance bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
              <div className="flex gap-6 text-xs font-bold text-slate-600">
                <span>Total Dr: <span className="text-rose-600 font-mono">₹{fmt(manualDebit)}</span></span>
                <span>Total Cr: <span className="text-emerald-600 font-mono">₹{fmt(manualCredit)}</span></span>
              </div>
              <span className={cn("text-xs font-extrabold px-3 py-1 rounded-full", isManualBalanced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                {isManualBalanced ? "✓ Balanced" : "✗ Unbalanced"}
              </span>
            </div>
          </div>
        )}

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting || (!isSmart && !isManualBalanced)}
          className={cn(
            "w-full py-4 text-sm font-extrabold rounded-2xl text-white shadow-xl transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r", config.gradient,
            "hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
            : <><Check className="h-4 w-4" /> Create {config.label}</>
          }
        </button>
      </form>
    </div>
  );
}
