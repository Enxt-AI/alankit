"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  X,
  Settings,
  FolderPlus,
  ChevronRight,
  Sparkles,
  Edit3,
  ArrowLeft,
  FileCheck,
  Calendar,
  Lock,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchGroups,
  fetchLedgers,
  fetchCustomVoucherTypes,
  fetchAccountingPeriods,
  createAccountingPeriod,
  updateAccountingPeriod,
  rolloverAccountingPeriod,
  deleteAccountingPeriod,
  updateLedger,
  createSunAccount,
  type AccountingGroup,
  type Ledger,
  type CustomVoucherType,
  type AccountingPeriod,
} from "@/lib/accounting-api";
import { LedgerDialog } from "@/components/accounting/ledger-dialog";
import { GroupDialog } from "@/components/accounting/group-dialog";
import { VoucherTypeDialog } from "@/components/accounting/voucher-type-dialog";
import { PeriodLockDialog } from "@/components/accounting/period-lock-dialog";

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  title,
  description,
  icon: Icon,
  gradient,
  children,
}: {
  title: string;
  description: string;
  icon: any;
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 px-7 py-5 border-b border-slate-100">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
            gradient
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <div className="p-7">{children}</div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionButton({
  icon: Icon,
  label,
  sublabel,
  gradient,
  onClick,
}: {
  icon: any;
  label: string;
  sublabel: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 w-full p-4 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-lg hover:-translate-y-0.5 bg-white transition-all duration-200 text-left"
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md group-hover:shadow-lg transition-all",
          gradient
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

// ── Create Menu Modal ────────────────────────────────────────────────────────
function CreateMenuModal({
  open,
  onClose,
  onCreateGroup,
  onCreateLedger,
  onCreateVoucherType,
  onAddSunCode,
}: {
  open: boolean;
  onClose: () => void;
  onCreateGroup: () => void;
  onCreateLedger: () => void;
  onCreateVoucherType: () => void;
  onAddSunCode: () => void;
}) {
  if (!open) return null;

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
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-50">
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-slate-900">
              Create New
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              What would you like to create?
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-5 top-6 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Create Ledger",
                icon: FileCheck,
                gradient: "from-blue-400 to-blue-600",
                description: "Create manual ledger",
                onClick: () => {
                  onCreateLedger();
                  onClose();
                },
              },
              {
                label: "Create Group",
                icon: FolderPlus,
                gradient: "from-amber-400 to-orange-500",
                description: "Create account group",
                onClick: () => {
                  onCreateGroup();
                  onClose();
                },
              },
              {
                label: "Voucher Type",
                icon: FileCheck,
                gradient: "from-emerald-400 to-emerald-600",
                description: "Create custom type",
                onClick: () => {
                  onCreateVoucherType();
                  onClose();
                },
              },
              {
                label: "Add Sun Code",
                icon: Plus,
                gradient: "from-indigo-400 to-indigo-600",
                description: "Add Sun account mapping",
                onClick: () => {
                  onAddSunCode();
                  onClose();
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-100 hover:border-transparent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white"
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md group-hover:shadow-lg transition-all",
                    item.gradient
                  )}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Search & Alter Ledger Dialog ─────────────────────────────────────────────
function AlterLedgerDialog({
  open,
  onClose,
  ledgers,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  onSelect: (ledger: Ledger) => void;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  if (!open) return null;

  const filtered = ledgers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.code && l.code.toLowerCase().includes(search.toLowerCase()))
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
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Select Ledger to Alter
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Search and select a ledger to edit its details
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 shrink-0">
          <input
            type="text"
            placeholder="Search ledger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              No ledgers found
            </p>
          ) : (
            filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  onSelect(l);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{l.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {l.code || "No code"}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border",
                    l.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  )}
                >
                  {l.isActive ? "Active" : "Suspended"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Search & Suspend Ledger Dialog ─────────────────────────────────────────────
function SuspendLedgerDialog({
  open,
  onClose,
  ledgers,
  onToggleStatus,
}: {
  open: boolean;
  onClose: () => void;
  ledgers: Ledger[];
  onToggleStatus: (ledgerId: string, currentStatus: boolean) => Promise<void>;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  if (!open) return null;

  const filtered = ledgers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.code && l.code.toLowerCase().includes(search.toLowerCase()))
  );

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
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Suspend Ledger
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Toggle the suspension status of any manual ledger account
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-all duration-150"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 shrink-0">
          <input
            type="text"
            placeholder="Search ledger to toggle status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 pb-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              No ledgers found
            </p>
          ) : (
            filtered.map((l) => (
              <div
                key={l.id}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <p className={cn("text-sm font-bold truncate", l.isActive ? "text-slate-800" : "text-slate-400 line-through")}>
                    {l.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {l.code || "No code"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await onToggleStatus(l.id, l.isActive);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl border transition-all active:scale-95 shadow-sm whitespace-nowrap",
                    l.isActive
                      ? "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
                      : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                  )}
                >
                  {l.isActive ? "Suspend" : "Activate"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Sun Code Dialog (Sketch Style) ─────────────────────────────────────────────
function SunCodeDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeVal = code.trim().toUpperCase();
    const nameVal = name.trim();
    if (!codeVal || !nameVal) {
      setError("Both Sun Code and Sun Ledger Name are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSunAccount({ code: codeVal, name: nameVal });
      setCode("");
      setName("");
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to add Sun Account");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

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
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-50">
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-slate-900">Add Sun Account Mapping</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Define a new Sun account mapping code and ledger description
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-5 top-6 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleAdd}>
          <div className="px-6 py-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. STOCKBSNEW"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Sun Ledger Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Closing Stocks-BS"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Add"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MasterSettingsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [sunCodeOpen, setSunCodeOpen] = useState(false);
  const [ledgerToAlter, setLedgerToAlter] = useState<Ledger | null>(null);
  const [voucherTypeOpen, setVoucherTypeOpen] = useState(false);
  const [typeToAlter, setTypeToAlter] = useState<CustomVoucherType | null>(null);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodToAlter, setPeriodToAlter] = useState<AccountingPeriod | null>(null);

  const [groups, setGroups] = useState<AccountingGroup[]>([]);
  const displayedGroups = useMemo(() => {
    return groups.filter((g) => g.name !== "Stocks");
  }, [groups]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomVoucherType[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  const loadCustomTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const res = await fetchCustomVoucherTypes(false);
      setCustomTypes(res || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetchGroups();
      setGroups(res.groups || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadLedgers = useCallback(async () => {
    setLoadingLedgers(true);
    try {
      const res = await fetchLedgers("ALL");
      setLedgers(res.ledgers || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingLedgers(false);
    }
  }, []);

  const loadPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    try {
      const res = await fetchAccountingPeriods();
      setPeriods(res || []);
    } catch {
      /* ignore */
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadLedgers();
    loadCustomTypes();
    loadPeriods();
  }, [loadGroups, loadLedgers, loadCustomTypes, loadPeriods]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        e.data &&
        (e.data.type === "LEDGER_ALTERED" ||
          e.data.type === "LEDGER_SUSPENDED" ||
          e.data.type === "LEDGER_CREATED")
      ) {
        handleRefresh();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToggleSuspension = async (ledgerId: string, currentStatus: boolean) => {
    try {
      await updateLedger(ledgerId, { isActive: !currentStatus });
      handleRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update ledger status");
    }
  };

  const handleRefresh = () => {
    loadGroups();
    loadLedgers();
    loadCustomTypes();
    loadPeriods();
  };

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-12">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-600 border border-slate-100 shadow-sm">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Master Settings
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">
              Create, alter, and manage your accounting setup
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <SectionCard
        title="Quick Actions"
        description="Common operations for your accounting module"
        icon={Sparkles}
        gradient="from-emerald-400 to-emerald-600"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Create */}
          <ActionButton
            icon={Plus}
            label="Create"
            sublabel="Create ledger, group or voucher type"
            gradient="from-emerald-400 to-emerald-600"
            onClick={() => setMenuOpen(true)}
          />
          {/* Alter Ledger */}
          <ActionButton
            icon={Edit3}
            label="Alter"
            sublabel="Edit manual ledger"
            gradient="from-blue-400 to-blue-600"
            onClick={() => {
              const w = window.screen.width;
              const h = window.screen.height;
              window.open(
                "/accounting/popup/alter-ledger",
                "AlterLedgerPopup",
                `width=${w},height=${h},scrollbars=yes,resizable=yes`
              );
            }}
          />
          {/* Suspend Ledger */}
          <ActionButton
            icon={Lock}
            label="Suspend"
            sublabel="Toggle manual ledger suspension"
            gradient="from-amber-500 to-orange-600"
            onClick={() => {
              const w = window.screen.width;
              const h = window.screen.height;
              window.open(
                "/accounting/popup/suspend-ledger",
                "SuspendLedgerPopup",
                `width=${w},height=${h},scrollbars=yes,resizable=yes`
              );
            }}
          />
        </div>
      </SectionCard>

      {/* ── Accounting Period Settings ────────────────────────────────── */}
      <SectionCard
        title="Accounting Periods & Freeze Locks"
        description="Establish financial year boundaries and locked historical date freeze gates"
        icon={Calendar}
        gradient="from-emerald-400 to-emerald-600"
      >
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Visual Tally Card */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-sm font-bold text-slate-800">Active Period Status</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPeriodToAlter(null);
                    setPeriodOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Set Period Lock
                </button>
              </div>
            </div>

            {periods.filter(p => p.isActive).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <Calendar className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700">No active accounting period</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                  Configure a financial year period and freeze lock dates to validate double-entry transaction posting.
                </p>
              </div>
            ) : (
              periods
                .filter((p) => p.isActive)
                .map((p) => {
                  const formatDateStr = (dateStr?: string) => {
                    if (!dateStr) return "—";
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return "—";
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                  };

                  const formatOpenPeriod = (period: AccountingPeriod) => {
                    if (period.lockStartDate && period.lockEndDate) {
                      const nextDay = new Date(period.lockEndDate);
                      nextDay.setDate(nextDay.getDate() + 1);
                      return `${formatDateStr(nextDay.toISOString())} to Today`;
                    }
                    return `${formatDateStr(period.startDate)} to Today`;
                  };

                  const formatLockedPeriod = (period: AccountingPeriod) => {
                    if (period.lockStartDate && period.lockEndDate) {
                      return `${formatDateStr(period.lockStartDate)} to ${formatDateStr(period.lockEndDate)}`;
                    }
                    return "No Locked Dates (Fully Open)";
                  };

                  const handleRollover = async (periodId: string) => {
                    if (!confirm("Are you sure you want to rollover to the next financial year? This will automatically advance dates by exactly 1 year, preserving months/days, and deactivate the current period.")) return;
                    try {
                      await rolloverAccountingPeriod(periodId);
                      handleRefresh();
                    } catch (err: any) {
                      alert(err?.response?.data?.message || err.message || "Rollover failed");
                    }
                  };

                  const handleDelete = async (periodId: string) => {
                    if (!confirm("Are you sure you want to delete this accounting period lock configuration?")) return;
                    try {
                      await deleteAccountingPeriod(periodId);
                      handleRefresh();
                    } catch (err: any) {
                      alert(err?.response?.data?.message || err.message || "Delete failed");
                    }
                  };

                  return (
                    <div key={p.id} className="space-y-4">
                      {/* Tally Spreadsheet Table design */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider">
                              <th className="py-3 px-4 border-r border-slate-100 w-16 text-center">Sr No</th>
                              <th className="py-3 px-6 border-r border-slate-100">Particular</th>
                              <th className="py-3 px-6">Date Period</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-4 border-r border-slate-100 text-center text-slate-400 font-mono">1</td>
                              <td className="py-3.5 px-6 border-r border-slate-100 font-semibold text-slate-900">Financial year Period</td>
                              <td className="py-3.5 px-6 font-mono text-slate-600 bg-slate-50/10">
                                {formatDateStr(p.startDate)} to {formatDateStr(p.endDate)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-4 border-r border-slate-100 text-center text-slate-400 font-mono">2</td>
                              <td className="py-3.5 px-6 border-r border-slate-100 font-semibold text-slate-900">Accounting Period Open</td>
                              <td className="py-3.5 px-6 font-mono text-emerald-700 font-bold bg-emerald-50/20">
                                {formatOpenPeriod(p)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-4 border-r border-slate-100 text-center text-slate-400 font-mono">3</td>
                              <td className="py-3.5 px-6 border-r border-slate-100 font-semibold text-slate-900">Accounting Period Locked</td>
                              <td className={cn("py-3.5 px-6 font-mono font-bold", p.lockStartDate ? "text-amber-700 bg-amber-50/30" : "text-slate-400 bg-slate-50/10")}>
                                {formatLockedPeriod(p)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Period Actions toolbar */}
                      <div className="flex flex-wrap gap-2 pt-2 justify-end">
                        <button
                          onClick={() => {
                            setPeriodToAlter(p);
                            setPeriodOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 bg-white transition-all shadow-sm"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit Configuration
                        </button>
                        <button
                          onClick={() => handleRollover(p.id)}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-transparent text-white bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-md"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Rollover Financial Year
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="flex items-center justify-center p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 bg-white transition-all shadow-sm"
                          title="Delete Configuration"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Sidebar Audit Period Logs */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3">Historical FY Cycles</h4>
            {periods.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">No previous configuration history.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {periods.map((hist) => {
                  const formatDateStr = (dateStr?: string) => {
                    if (!dateStr) return "—";
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return "—";
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                  };

                  const handleActivate = async () => {
                    try {
                      await updateAccountingPeriod(hist.id, { isActive: true });
                      handleRefresh();
                    } catch (err: any) {
                      alert(err?.response?.data?.message || "Failed to activate period");
                    }
                  };

                  return (
                    <div
                      key={hist.id}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all text-left w-full flex items-center justify-between gap-3",
                        hist.isActive
                          ? "bg-emerald-50/30 border-emerald-200 shadow-sm"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900">{hist.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatDateStr(hist.startDate)} to {formatDateStr(hist.endDate)}
                        </p>
                      </div>
                      {!hist.isActive && (
                        <button
                          onClick={handleActivate}
                          className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 shadow-sm transition-all"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Account Groups ────────────────────────────────────────────── */}
      <SectionCard
        title="Account Groups"
        description="Manage your chart-of-account groupings"
        icon={FolderPlus}
        gradient="from-amber-400 to-orange-500"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 font-medium">
            {loadingGroups
              ? "Loading…"
              : `${displayedGroups.length} group${displayedGroups.length !== 1 ? "s" : ""} defined`}
          </p>
          <button
            onClick={() => setGroupOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> New Group
          </button>
        </div>

        {displayedGroups.length === 0 && !loadingGroups ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FolderPlus className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No groups yet</p>
            <p className="text-xs mt-1">
              Click "New Group" to create your first accounting group
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedGroups.map((g) => (
              <div
                key={g.id}
                className="flex items-start gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-extrabold shadow-sm">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {g.name}
                    </p>
                    <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                      {g.code || g.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {g.under}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Account Ledgers ────────────────────────────────────────────── */}
      <SectionCard
        title="Account Ledgers"
        description="Manage your manual ledger accounts and balances"
        icon={FileCheck}
        gradient="from-blue-400 to-indigo-600"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 font-medium">
            {loadingLedgers
              ? "Loading…"
              : `${ledgers.length} ledger${ledgers.length !== 1 ? "s" : ""} defined`}
          </p>
          <button
            onClick={() => {
              setLedgerToAlter(null);
              setLedgerOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> New Ledger
          </button>
        </div>

        {ledgers.length === 0 && !loadingLedgers ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FileCheck className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No manual ledgers yet</p>
            <p className="text-xs mt-1">
              Click "New Ledger" to create your first manual ledger
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ledgers.map((l) => (
              <div
                key={l.id}
                onClick={() => {
                  setLedgerToAlter(l);
                  setLedgerOpen(true);
                }}
                className="flex items-start justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white text-xs font-extrabold shadow-sm bg-gradient-to-br",
                      l.type === "BANK"
                        ? "from-blue-400 to-blue-600"
                        : l.type === "SALE"
                        ? "from-emerald-400 to-teal-500"
                        : l.type === "STOCK"
                        ? "from-indigo-400 to-purple-600"
                        : "from-indigo-400 to-indigo-600"
                    )}
                  >
                    {l.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-bold truncate",
                        l.isActive ? "text-slate-900" : "text-slate-400 line-through"
                      )}
                    >
                      {l.name}
                    </p>
                    <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mt-1">
                      {groups.find((g) => g.id === l.groupId)?.name || l.type}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end justify-center">
                  <div>
                    <p className="text-xs font-bold font-mono text-slate-700">
                      ₹
                      {Math.abs(l.currentBalance).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {l.currentBalance >= 0 ? "Dr" : "Cr"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Voucher Types ──────────────────────────────────────────────── */}
      <SectionCard
        title="Voucher Types"
        description="Manage configured custom tally-style voucher types"
        icon={FileCheck}
        gradient="from-emerald-500 to-emerald-700"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 font-medium">
            {loadingTypes
              ? "Loading…"
              : `${customTypes.length} type${customTypes.length !== 1 ? "s" : ""} defined`}
          </p>
          <button
            onClick={() => {
              setTypeToAlter(null);
              setVoucherTypeOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> New Voucher Type
          </button>
        </div>

        {customTypes.length === 0 && !loadingTypes ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FileCheck className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No custom voucher types yet</p>
            <p className="text-xs mt-1">
              Click "New Voucher Type" to create your first dynamic tally-style voucher type
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customTypes.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setTypeToAlter(t);
                  setVoucherTypeOpen(true);
                }}
                className="flex items-start justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-extrabold shadow-sm animate-pulse-slow">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm font-bold truncate", t.isActive ? "text-slate-900" : "text-slate-400 line-through")}>
                        {t.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Base: {t.baseType === "PAYMENT_SALES" ? "Sale" : t.baseType === "RECEIPT" ? "Receipt" : "Journal"}
                      </span>
                      <span className={cn(
                        "inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full",
                        t.needsApproval !== false
                          ? "bg-amber-50/50 text-amber-700 border border-amber-100/50"
                          : "bg-emerald-50/50 text-emerald-700 border border-emerald-100/50"
                      )}>
                        {t.needsApproval !== false ? "Requires Approval" : "Auto Post"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block font-mono text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    Prefix: {t.prefix || "—"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {t.isActive ? "Active" : "Suspended"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <CreateMenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCreateGroup={() => {
          setMenuOpen(false);
          setGroupOpen(true);
        }}
        onCreateLedger={() => {
          setMenuOpen(false);
          setLedgerToAlter(null);
          setLedgerOpen(true);
        }}
        onCreateVoucherType={() => {
          setMenuOpen(false);
          setTypeToAlter(null);
          setVoucherTypeOpen(true);
        }}
        onAddSunCode={() => {
          setMenuOpen(false);
          setSunCodeOpen(true);
        }}
      />
      <SunCodeDialog
        open={sunCodeOpen}
        onClose={() => setSunCodeOpen(false)}
        onAdded={handleRefresh}
      />
      <LedgerDialog
        open={ledgerOpen}
        onClose={() => {
          setLedgerOpen(false);
          setLedgerToAlter(null);
        }}
        groups={groups}
        onCreated={handleRefresh}
        ledgerToAlter={ledgerToAlter}
      />
      <GroupDialog
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        onCreated={handleRefresh}
      />
      <VoucherTypeDialog
        open={voucherTypeOpen}
        onClose={() => {
          setVoucherTypeOpen(false);
          setTypeToAlter(null);
        }}
        onCreated={handleRefresh}
        typeToAlter={typeToAlter}
      />
      <PeriodLockDialog
        open={periodOpen}
        onClose={() => {
          setPeriodOpen(false);
          setPeriodToAlter(null);
        }}
        onCreated={handleRefresh}
        periodToAlter={periodToAlter}
      />
    </div>
  );
}
