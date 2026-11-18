"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchSelect } from "@/components/ui/search-select";
import {
  createLedger,
  updateLedger,
  deleteLedger,
  fetchSunAccounts,
  type AccountingGroup,
  type Ledger,
} from "@/lib/accounting-api";

interface LedgerDialogProps {
  open: boolean;
  onClose: () => void;
  groups: AccountingGroup[];
  onCreated: () => void;
  ledgerToAlter?: Ledger | null;
}

export function LedgerDialog({
  open,
  onClose,
  groups,
  onCreated,
  ledgerToAlter,
}: LedgerDialogProps) {
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [balanceType, setBalanceType] = useState<"Dr" | "Cr">("Dr");
  const [groupId, setGroupId] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Sun Code details
  const [sunCode, setSunCode] = useState("");
  const [sunName, setSunName] = useState("");
  const [createdLedger, setCreatedLedger] = useState<Ledger | null>(null);

  // Dynamic Sun Accounts list (loads from database)
  const [sunAccounts, setSunAccounts] = useState<{ code: string; name: string }[]>([]);

  // Bank details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // Tax details
  const [pan, setPan] = useState("");
  const [gstNo, setGstNo] = useState("");

  const [openingQuantity, setOpeningQuantity] = useState("");
  const [openingRate, setOpeningRate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (ledgerToAlter) {
        setName(ledgerToAlter.name);
        const ob = ledgerToAlter.openingBalance || 0;
        setOpeningBalance(String(Math.abs(ob)));
        setBalanceType(ob < 0 ? "Cr" : "Dr");
        setGroupId(ledgerToAlter.groupId || "");
        setAddress(ledgerToAlter.address || "");
        setBankName(ledgerToAlter.bankName || "");
        setAccountNumber(ledgerToAlter.accountNumber || "");
        setIfscCode(ledgerToAlter.ifscCode || "");
        setPan(ledgerToAlter.pan || "");
        setGstNo(ledgerToAlter.gstNo || "");
        setIsActive(ledgerToAlter.isActive);
        setSunCode(ledgerToAlter.sunCode || "");
        setSunName(ledgerToAlter.sunName || "");
        setOpeningQuantity(ledgerToAlter.stock?.openingQuantity != null ? String(ledgerToAlter.stock.openingQuantity) : "");
        setOpeningRate(ledgerToAlter.stock?.openingRate != null ? String(ledgerToAlter.stock.openingRate) : "");
      } else {
        setName("");
        setOpeningBalance("");
        setGroupId("");
        setAddress("");
        setBankName("");
        setAccountNumber("");
        setIfscCode("");
        setPan("");
        setGstNo("");
        setBalanceType("Dr");
        setIsActive(true);
        setSunCode("");
        setSunName("");
        setOpeningQuantity("");
        setOpeningRate("");
      }
      setCreatedLedger(null);
      setError(null);
    }
  }, [open, ledgerToAlter]);

  // Load Sun Accounts from Database
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

  // Automatically update Sun Name when Sun Code changes
  useEffect(() => {
    const matched = sunAccounts.find((s) => s.code === sunCode);
    setSunName(matched ? matched.name : "");
  }, [sunCode, sunAccounts]);

  // Set default balance type (Dr/Cr) automatically based on standard accounting rules for the group
  useEffect(() => {
    if (ledgerToAlter) return;
    const selected = groups.find((g) => g.id === groupId);
    if (selected) {
      const drGroups = [
        "Bank Accounts",
        "Current Assets",
        "Fixed Assets",
        "Purchase Accounts",
        "Direct Expenses",
        "Indirect Expenses",
      ];
      const crGroups = [
        "Capital Account",
        "Current Liabilities",
        "Sales Accounts",
        "Direct Income",
        "Indirect Income",
      ];
      if (drGroups.includes(selected.under)) {
        setBalanceType("Dr");
      } else if (crGroups.includes(selected.under)) {
        setBalanceType("Cr");
      }
    }
  }, [groupId, groups, ledgerToAlter]);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const derivedType: "BANK" | "SALE" | "PURCHASE" | "USER" | "STOCK" = ledgerToAlter?.type === "STOCK" || (selectedGroup && (selectedGroup.name === "Stocks" || selectedGroup.under === "Stocks"))
    ? "STOCK"
    : selectedGroup
    ? selectedGroup.under === "Bank Accounts"
      ? "BANK"
      : selectedGroup.under === "Sales Accounts" ||
        selectedGroup.under === "Direct Income" ||
        selectedGroup.under === "Indirect Income"
      ? "SALE"
      : selectedGroup.under === "Purchase Accounts"
      ? "PURCHASE"
      : "USER"
    : "USER";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ledger name is required");
      return;
    }
    if (!groupId) {
      setError("Group is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const balance = derivedType === "STOCK" ? 0 : parseFloat(openingBalance) || 0;
      const signedBalance = balanceType === "Cr" ? -balance : balance;
      const payload = {
        name: name.trim(),
        openingBalance: signedBalance,
        groupId: groupId,
        address: address || undefined,
        pan: pan.trim() || undefined,
        gstNo: gstNo.trim() || undefined,
        bankName: derivedType === "BANK" ? bankName : undefined,
        accountNumber: derivedType === "BANK" ? accountNumber : undefined,
        ifscCode: derivedType === "BANK" ? ifscCode : undefined,
        isActive,
        sunCode: derivedType === "STOCK" ? undefined : (sunCode || undefined),
        sunName: derivedType === "STOCK" ? undefined : (sunName || undefined),
        openingQuantity: derivedType === "STOCK" ? (parseFloat(openingQuantity) || 0) : undefined,
        openingRate: derivedType === "STOCK" ? 0 : undefined,
      };

      if (ledgerToAlter) {
        await updateLedger(ledgerToAlter.id, payload);
        onCreated();
        onClose();
      } else {
        const newLedger = await createLedger({
          ...payload,
          type: derivedType,
        });
        setCreatedLedger(newLedger);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save ledger");
    } finally {
      setSubmitting(false);
    }
  };



  if (!open) return null;

  if (createdLedger) {
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        style={{
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(6px)",
        }}
        onClick={() => {
          onCreated();
          onClose();
          setCreatedLedger(null);
        }}
      >
        <div
          className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 bg-emerald-50/50 shrink-0">
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
              onClick={() => {
                onCreated();
                onClose();
                setCreatedLedger(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Details Table */}
          <div className="p-6 overflow-y-auto space-y-6">
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
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
            <button
              onClick={() => {
                onCreated();
                onClose();
                setCreatedLedger(null);
              }}
              className="px-6 py-2.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }
  const inputCls =
    "w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all";

  // Group options grouped by parent (under)
  const filteredGroups = groups.filter(
    (g) =>
      ledgerToAlter?.type === "STOCK" || g.name !== "Stocks"
  );

  const groupsByParent = filteredGroups.reduce<Record<string, AccountingGroup[]>>(
    (acc, g) => {
      const key = g.under || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(g);
      return acc;
    },
    {}
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {ledgerToAlter ? "Alter Ledger" : "Ledger Creation"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {ledgerToAlter
                ? "Modify or delete this manual ledger account"
                : "Create a new manual ledger account"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Top Section: Ledger Name & Under (Group) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HDFC Bank, Sales Revenue"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Under (Group) *
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className={inputCls}
                required
                disabled={derivedType === "STOCK"}
              >
                <option value="" disabled>
                  Select a Group
                </option>
                {Object.entries(groupsByParent).map(([parent, items]) => (
                  <optgroup key={parent} label={parent}>
                    {items.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.code ? `(${g.code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Sun Code & Sun Name selection */}
          {derivedType !== "STOCK" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-5 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Code (Optional)
                </label>
                <SearchSelect
                  options={[
                    { id: "", name: "None" },
                    ...sunAccounts.map((s) => ({ id: s.code, name: s.code, code: s.name }))
                  ]}
                  value={sunCode}
                  onChange={(val) => setSunCode(val)}
                  placeholder="Search Sun Code..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Ledger Name
                </label>
                <input
                  value={sunName}
                  readOnly
                  placeholder="Select a Sun Code to auto-fill"
                  className={cn(inputCls, "bg-slate-50 text-slate-500 font-semibold cursor-not-allowed")}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-5">
            {/* Left Column: Bank details */}
            <div className="space-y-4">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Bank Details
              </p>
              {derivedType === "BANK" ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Bank Name
                    </label>
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Account Number
                    </label>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Account No"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      IFSC Code
                    </label>
                    <input
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      placeholder="e.g. HDFC0001234"
                      className={inputCls}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
                  Bank Details are only applicable for accounts under "Bank
                  Accounts" group.
                </div>
              )}
            </div>

            {/* Right Column: Mailing & Tax Details */}
            <div className="space-y-4">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Mailing & Tax Details
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Full address"
                    rows={2}
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      PAN / IT No.
                    </label>
                    <input
                      value={pan}
                      onChange={(e) => setPan(e.target.value)}
                      placeholder="ABCDE1234F"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      GSTIN / UIN
                    </label>
                    <input
                      value={gstNo}
                      onChange={(e) => setGstNo(e.target.value)}
                      placeholder="GSTIN"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Opening Balance or Stock Opening Quantity */}
          {derivedType === "STOCK" ? (
            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 gap-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Opening Quantity *
                </label>
                <input
                  type="number"
                  step="1"
                  value={openingQuantity}
                  onChange={(e) => setOpeningQuantity(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Opening Balance
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      className={cn(inputCls, "pl-7")}
                    />
                  </div>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1">
                    {(["Dr", "Cr"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBalanceType(type)}
                        className={cn(
                          "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                          balanceType === type
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Submit / Delete */}
          <div className="flex gap-3 mt-2 border-t border-slate-100 pt-5">

            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                "Saving…"
              ) : (
                <>
                  <Plus className="h-4 w-4" />{" "}
                  {ledgerToAlter ? "Save Changes" : "Create Ledger"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
