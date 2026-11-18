"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Edit3,
  Loader2,
  Hash,
  Activity,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchLedgers,
  fetchGroups,
  type Ledger,
  type AccountingGroup,
} from "@/lib/accounting-api";
import { LedgerDialog } from "@/components/accounting/ledger-dialog";

export default function AlterLedgerPopup() {
  const [search, setSearch] = useState("");
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerToAlter, setLedgerToAlter] = useState<Ledger | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ledgersRes, groupsRes] = await Promise.all([
        fetchLedgers("ALL"),
        fetchGroups(),
      ]);
      setLedgers(ledgersRes.ledgers || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredGroupsForDisplay = useMemo(() => {
    return groups.filter((g) => g.name !== "Stocks");
  }, [groups]);

  const filtered = ledgers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.code && l.code.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAltered = () => {
    loadData();
    if (window.opener) {
      window.opener.postMessage({ type: "LEDGER_ALTERED" }, "*");
    }
  };

  const total = ledgers.length;
  const activeCount = ledgers.filter((l) => l.isActive).length;
  const groupCount = filteredGroupsForDisplay.length;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans antialiased text-slate-800">
      {/* Sticky Header - Production Grade Minimal (No Close Button) */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-150 text-slate-600">
            <Edit3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">Alter Ledger Accounts</h1>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              Select any manual ledger account to alter its name, group, or opening parameters.
            </p>
          </div>
        </div>
      </div>

      {/* Main Full-Width Content Layout */}
      <div className="w-full px-8 py-6 space-y-6 flex-1 flex flex-col">
        {/* Metric Ribbon for Full-Width Balance */}
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              label: "Total Ledgers",
              value: total,
              icon: Hash,
              color: "text-slate-600 bg-slate-50 border-slate-155",
            },
            {
              label: "Active Accounts",
              value: activeCount,
              icon: Activity,
              color: "text-emerald-700 bg-emerald-50/50 border-emerald-150",
            },
            {
              label: "Accounting Groups",
              value: groupCount,
              icon: FolderOpen,
              color: "text-indigo-700 bg-indigo-50/50 border-indigo-150",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-150 p-4.5 flex items-center justify-between shadow-sm"
            >
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">{stat.value}</p>
              </div>
              <div className={cn("h-10 w-10 rounded-lg border flex items-center justify-center", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          ))}
        </div>

        {/* Sleek Search Bar */}
        <div className="relative bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3.5 flex items-center gap-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
          <Search className="h-4.5 w-4.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search ledger by name or account code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
            autoFocus
          />
        </div>

        {/* Full-Width Table */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-3.5" />
              <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Loading accounts...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 flex-1">
              <Search className="h-10 w-10 text-slate-300 mb-3.5" />
              <p className="text-sm font-bold text-slate-700">No ledgers found</p>
              <p className="text-xs text-slate-400 mt-1">
                Verify the ledger name or adjust search query filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-6 w-16 text-center">Sr</th>
                    <th className="py-3.5 px-6 w-36">Ledger Code</th>
                    <th className="py-3.5 px-6">Account Name</th>
                    <th className="py-3.5 px-6 w-44">Accounting Group</th>
                    <th className="py-3.5 px-6 w-36">Type</th>
                    <th className="py-3.5 px-6 w-40 text-right">Current Balance</th>
                    <th className="py-3.5 px-6 w-36 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filtered.map((l, index) => (
                    <tr
                      key={l.id}
                      onClick={() => {
                        setLedgerToAlter(l);
                        setLedgerOpen(true);
                      }}
                      className={cn(
                        "hover:bg-slate-50/40 cursor-pointer transition-colors group",
                        !l.isActive && "bg-slate-50/20"
                      )}
                    >
                      <td className="py-4 px-6 font-bold text-slate-400 text-center">{index + 1}</td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-500">
                        <span className="bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded text-[10px]">
                          {l.code || l.id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p
                          className={cn(
                            "text-sm font-bold tracking-tight group-hover:text-slate-900",
                            l.isActive ? "text-slate-800" : "text-slate-400 line-through"
                          )}
                        >
                          {l.name}
                        </p>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-semibold">
                        {groups.find((g) => g.id === l.groupId)?.name || "—"}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded">
                          {l.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-slate-800">
                        ₹
                        {Math.abs(l.currentBalance).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                          {l.currentBalance >= 0 ? "Dr" : "Cr"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border shadow-sm tracking-wider uppercase",
                            l.isActive
                              ? "bg-emerald-50/60 text-emerald-700 border-emerald-150"
                              : "bg-amber-50/60 text-amber-700 border-amber-150"
                          )}
                        >
                          {l.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ledger Edit Modal Form */}
      <LedgerDialog
        open={ledgerOpen}
        onClose={() => {
          setLedgerOpen(false);
          setLedgerToAlter(null);
        }}
        groups={groups}
        onCreated={handleAltered}
        ledgerToAlter={ledgerToAlter}
      />
    </div>
  );
}
