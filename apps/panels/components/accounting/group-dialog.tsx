"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createGroup } from "@/lib/accounting-api";

const GROUP_UNDER_OPTIONS = [
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
];

interface GroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function GroupDialog({ open, onClose, onCreated }: GroupDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [under, setUnder] = useState("Capital Account");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGroup, setCreatedGroup] = useState<any | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setUnder("Capital Account");
      setError(null);
      setCreatedGroup(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    if (code.trim() && code.trim().length !== 6) {
      setError("Group code must be exactly 6 characters");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const newGroup = await createGroup({
        name: name.trim(),
        code: code.trim() || undefined,
        under,
        isSublLedger: false,
        nettBalance: false,
        usedForCalc: false,
        allocationMethod: "Not Applicable",
      });
      setCreatedGroup(newGroup);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  const isProfitLoss = [
    "Sales Accounts",
    "Purchase Accounts",
    "Direct Expenses",
    "Indirect Expenses",
    "Direct Income",
    "Indirect Income",
  ].includes(under);

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

  if (!open) return null;

  // Show Tally-style details pop-up upon successful creation
  if (createdGroup) {
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
          setCreatedGroup(null);
        }}
      >
        <div
          className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200"
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
                  Group Created Successfully
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
                setCreatedGroup(null);
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
                      <th className="py-3.5 px-4 font-bold min-w-[110px]">Group Code</th>
                      <th className="py-3.5 px-4 font-bold min-w-[150px]">Group Name</th>
                      <th className="py-3.5 px-4 font-bold min-w-[160px]">Balance Sheet Group</th>
                      <th className="py-3.5 px-4 font-bold min-w-[100px] text-center">Group Status</th>
                      <th className="py-3.5 px-4 font-bold min-w-[140px] pr-5">Creation Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400 text-center">1</td>
                      <td className="py-4 px-4 font-mono font-bold text-amber-700">
                        <span className="bg-amber-50 px-2 py-0.5 rounded-md">
                          {createdGroup.code || `GRP-${createdGroup.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">{createdGroup.name}</td>
                      <td className="py-4 px-4 font-semibold text-slate-600">{createdGroup.under}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Active
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap pr-5 font-semibold">
                        {formatDate(createdGroup.createdAt)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-xs text-amber-800">
              <Plus className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-extrabold">Master Record Synced</p>
                <p className="mt-0.5 text-amber-700 font-medium">
                  This group has been appended to the Chart of Accounts. You can now assign user, bank, or system control ledgers under it.
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
                setCreatedGroup(null);
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
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Group Creation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Add a new Tally-style accounting group
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
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Group Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trading Account"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Group Code (Optional, 6 characters)
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="e.g. GR0001 (Auto-generated if blank)"
              className={inputCls}
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Under (Parent Group) *
            </label>
            <select
              value={under}
              onChange={(e) => setUnder(e.target.value)}
              className={inputCls}
            >
              {GROUP_UNDER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* Statement Influence Indicator */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Statement Influence
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  "p-3 rounded-xl border text-center transition-all duration-200",
                  isProfitLoss
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm font-extrabold"
                    : "bg-white border-slate-100 text-slate-400 opacity-60"
                )}
              >
                <p className="text-xs uppercase tracking-wider">
                  Profit & Loss A/c
                </p>
              </div>
              <div
                className={cn(
                  "p-3 rounded-xl border text-center transition-all duration-200",
                  !isProfitLoss
                    ? "bg-blue-50 border-blue-200 text-blue-800 shadow-sm font-extrabold"
                    : "bg-white border-slate-100 text-slate-400 opacity-60"
                )}
              >
                <p className="text-xs uppercase tracking-wider">
                  Balance Sheet
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 mt-2 text-sm font-bold rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Creating…"
            ) : (
              <>
                <Plus className="h-4 w-4" /> Create Group
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
