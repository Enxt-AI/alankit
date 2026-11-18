"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCustomVoucherType, updateCustomVoucherType, type CustomVoucherType } from "@/lib/accounting-api";

const BASE_TYPE_OPTIONS = [
  { value: "PAYMENT_SALES", label: "Sale / Payment Voucher (PAYMENT_SALES)" },
  { value: "RECEIPT", label: "Purchase / Receipt Voucher (RECEIPT)" },
  { value: "JOURNAL", label: "Journal Voucher (JOURNAL)" },
];

interface VoucherTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  typeToAlter: CustomVoucherType | null;
}

export function VoucherTypeDialog({ open, onClose, onCreated, typeToAlter }: VoucherTypeDialogProps) {
  const [name, setName] = useState("");
  const [baseType, setBaseType] = useState<"PAYMENT_SALES" | "RECEIPT" | "JOURNAL" | "STOCK_JOURNAL" | "DEBIT_NOTE" | "CREDIT_NOTE">("PAYMENT_SALES");
  const [prefix, setPrefix] = useState("");
  const [needsApproval, setNeedsApproval] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdType, setCreatedType] = useState<CustomVoucherType | null>(null);

  useEffect(() => {
    if (open) {
      if (typeToAlter) {
        setName(typeToAlter.name);
        setBaseType(typeToAlter.baseType);
        setPrefix(typeToAlter.prefix || "");
        setNeedsApproval(typeToAlter.needsApproval !== undefined ? typeToAlter.needsApproval : true);
        setIsActive(typeToAlter.isActive);
      } else {
        setName("");
        setBaseType("PAYMENT_SALES");
        setPrefix("");
        setNeedsApproval(true);
        setIsActive(true);
      }
      setError(null);
      setCreatedType(null);
    }
  }, [open, typeToAlter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Voucher type name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (typeToAlter) {
        const updated = await updateCustomVoucherType(typeToAlter.id, {
          name: name.trim(),
          baseType,
          prefix: prefix.trim() || undefined,
          needsApproval,
          isActive,
        });
        onCreated();
        onClose();
      } else {
        const created = await createCustomVoucherType({
          name: name.trim(),
          baseType,
          prefix: prefix.trim() || undefined,
          needsApproval,
        });
        setCreatedType(created);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save voucher type");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    const d = dateString ? new Date(dateString) : new Date();
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (!open) return null;

  // Show Tally-style success pop-up upon successful creation
  if (createdType) {
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
          setCreatedType(null);
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
                  Voucher Type Created Successfully
                </h2>
                <p className="text-xs text-emerald-700 font-bold tracking-wide uppercase mt-0.5">
                  Tally Accounting Configuration Master
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onCreated();
                onClose();
                setCreatedType(null);
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
                      <th className="py-3.5 px-4 font-bold min-w-[150px]">Voucher Type Name</th>
                      <th className="py-3.5 px-4 font-bold min-w-[150px]">Base Parent Type</th>
                      <th className="py-3.5 px-4 font-bold min-w-[100px] text-center">Prefix Code</th>
                      <th className="py-3.5 px-4 font-bold min-w-[100px] text-center">Status</th>
                      <th className="py-3.5 px-4 font-bold min-w-[140px] pr-5">Creation Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400 text-center">1</td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">{createdType.name}</td>
                      <td className="py-4 px-4 font-semibold text-slate-600 font-mono text-[11px]">{createdType.baseType}</td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-emerald-700">
                        <span className="bg-emerald-50 px-2.5 py-0.5 rounded-md">
                          {createdType.prefix || "SAL / RCP / JV"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Active
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap pr-5 font-semibold">
                        {formatDate(createdType.createdAt)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-xs text-emerald-800">
              <Plus className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-extrabold">Voucher Type Activated</p>
                <p className="mt-0.5 text-emerald-700 font-medium">
                  This custom voucher type has been compiled successfully. You can now choose it directly on the Voucher Entry form to record transactions with the custom prefix.
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
                setCreatedType(null);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {typeToAlter ? "Alter Voucher Type" : "Voucher Type Creation"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {typeToAlter ? "Modify configured custom voucher type" : "Add a new custom voucher type layered on Tally base types"}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Voucher Type Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GST Sales"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Base Parent Voucher Type *
            </label>
            <select
              value={baseType}
              onChange={(e) => setBaseType(e.target.value as any)}
              className={inputCls}
              disabled={!!typeToAlter}
            >
              {BASE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {typeToAlter && (
              <p className="text-[10px] text-slate-400 mt-1">Parent base type cannot be modified after creation.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Voucher Number Prefix (Optional)
            </label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. GSTS- or PC-"
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Leave empty to use base type prefixes (SAL, RCP, JV).</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-800">Requires Audit Approval</p>
              <p className="text-[10px] text-slate-400 font-medium">Auto-posts to ledger balances and stock quantities instantly if disabled</p>
            </div>
            <button
              type="button"
              onClick={() => setNeedsApproval(!needsApproval)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                needsApproval ? "bg-emerald-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  needsApproval ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {typeToAlter && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-800">Active Status</p>
                <p className="text-[10px] text-slate-400 font-medium">Inactive voucher types will be hidden from entry selection</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isActive ? "bg-emerald-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isActive ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 mt-4 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-white hover:opacity-90 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Saving…"
            ) : (
              <>
                {typeToAlter ? "Save Changes" : (
                  <>
                    <Plus className="h-4 w-4" /> Create Voucher Type
                  </>
                )}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
