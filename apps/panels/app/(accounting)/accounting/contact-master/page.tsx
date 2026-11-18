"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ContactRound,
  Building2,
  Users,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Phone,
  Mail,
  MapPin,
  Download,
  Plus,
  Eye,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fetchLedgers, type Ledger } from "@/lib/accounting-api";

// ── Helpers ──
const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getContactType = (ledger: Ledger): string => {
  if (ledger.type === "BANK") return "Bank";
  return "Client";
};

type FilterType = "ALL" | "CLIENT" | "BANK";

export default function ContactMasterPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [selectedContact, setSelectedContact] = useState<Ledger | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLedgers("USER");
        if (!active) return;
        setLedgers(res.ledgers || []);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Failed to load contacts");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Filtered contacts — only show users with completed KYC
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // Only show ledgers whose linked user has completed KYC
    let list = ledgers.filter(
      (l) => l.user && l.user.kycStatus === "VERIFIED"
    );

    // Search filter
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.code && l.code.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q)) ||
          (l.pan && l.pan.toLowerCase().includes(q)) ||
          (l.gstNo && l.gstNo.toLowerCase().includes(q)) ||
          (l.bankName && l.bankName.toLowerCase().includes(q)) ||
          (l.address && l.address.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = useMemo(() => {
    return filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredContacts, currentPage]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Selection handlers
  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllPaginatedSelected = useMemo(() => {
    if (paginatedContacts.length === 0) return false;
    return paginatedContacts.every((c) => selectedIds.includes(c.id));
  }, [paginatedContacts, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllPaginatedSelected) {
      const pageIds = paginatedContacts.map((c) => c.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedContacts.map((c) => c.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  // Summary stats
  const stats = useMemo(() => {
    const total = ledgers.length;
    const clients = ledgers.filter((l) => l.type === "USER").length;
    const banks = ledgers.filter((l) => l.type === "BANK").length;
    const withEmail = ledgers.filter((l) => l.email).length;
    return { total, clients, banks, withEmail };
  }, [ledgers]);

  const openDetail = (contact: Ledger) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  // CSV Export (Export all or Export only selected)
  const exportCSV = (onlySelected = false) => {
    const contactsToExport = onlySelected
      ? filteredContacts.filter((c) => selectedIds.includes(c.id))
      : filteredContacts;

    if (contactsToExport.length === 0) return;
    const headers = [
      "Sr No", "Ledger Code", "Ledger Name", "Pan No", "Address", "City",
      "State", "Mobile No", "Email ID", "DP Account No", "Bank Account No",
      "IFSC Code", "Bank Name",
    ];
    const csvRows = contactsToExport.map((l, idx) => [
      idx + 1, l.code || "", l.name, l.pan || "", l.address || "",
      (l.metadata as any)?.city || "", (l.metadata as any)?.state || "",
      l.phone || "", l.email || "", l.dematAccountNo || "",
      l.accountNumber || l.clientBankAccountNo || "",
      l.ifscCode || l.clientIfscCode || "", l.bankName || "",
    ]);
    const csvContent = [
      "\uFEFF" + headers.join(","),
      ...csvRows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `contact_master_${onlySelected ? "selected_" : ""}${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Master Data
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ContactRound className="h-8 w-8 text-emerald-600 shrink-0" />
            Contact Master
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Complete directory of all clients and party contacts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
                {selectedIds.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="h-9 px-3 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50 transition-all font-semibold"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => exportCSV(true)}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export Selected ({selectedIds.length})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(false)}
            disabled={filteredContacts.length === 0}
            className="h-9 px-3.5 rounded-xl border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-semibold"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Export All ({filteredContacts.length})
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, code, PAN, phone, email, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-900">{filteredContacts.length}</span> verified contacts
        </div>
      </div>


      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <Card className="border-none shadow-sm bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/80">
                <TableRow className="hover:bg-slate-100/80 border-slate-200">
                  <TableHead className="h-12 w-12 text-center pl-4 border-r border-slate-200/50">
                    <input
                      type="checkbox"
                      checked={isAllPaginatedSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest pl-4 whitespace-nowrap min-w-[50px] border-r border-slate-200/50">
                    Sr No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[110px] border-r border-slate-200/50">
                    Ledger Code
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[180px] border-r border-slate-200/50">
                    Ledger Name
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[110px] border-r border-slate-200/50">
                    Pan No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[200px] border-r border-slate-200/50">
                    Address
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[120px] border-r border-slate-200/50">
                    City
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[120px] border-r border-slate-200/50">
                    State
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[120px] border-r border-slate-200/50">
                    Mobile No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[180px] border-r border-slate-200/50">
                    Email ID
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[140px] border-r border-slate-200/50">
                    DP Account No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[140px] border-r border-slate-200/50">
                    Bank Account No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[110px] border-r border-slate-200/50">
                    IFSC Code
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[150px] pr-5">
                    Bank Name
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={14} className="py-16 text-center">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileSpreadsheet className="h-10 w-10 mb-2 text-slate-300" />
                        <p className="font-bold text-slate-500">No contacts found</p>
                        <p className="text-sm mt-0.5">
                          {searchQuery
                            ? "Try adjusting your search query."
                            : "Create ledgers to populate the contact master."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact, idx) => {
                    const isSelected = selectedIds.includes(contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors border-slate-100/50 text-xs cursor-pointer",
                          isSelected && "bg-emerald-50/40"
                        )}
                        onClick={() => openDetail(contact)}
                      >
                        {/* Checkbox */}
                        <TableCell className="py-3 text-center pl-4 border-r border-slate-100/50" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectOne(contact.id, e as any)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                          />
                        </TableCell>

                        {/* Sr No */}
                        <TableCell className="py-3 pl-4 border-r border-slate-100/50">
                          <span className="font-bold text-slate-500 tabular-nums">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </span>
                        </TableCell>

                      {/* Ledger Code */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md">
                          {contact.code || "—"}
                        </span>
                      </TableCell>

                      {/* Ledger Name */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-bold text-slate-800">{contact.name}</span>
                      </TableCell>

                      {/* Pan No */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-mono text-slate-600">{contact.pan || "—"}</span>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="py-3 border-r border-slate-100/50 max-w-[200px]">
                        <p className="text-slate-600 font-medium leading-snug truncate">
                          {contact.address || "—"}
                        </p>
                      </TableCell>

                      {/* City */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-medium text-slate-600">
                          {(contact.metadata as any)?.city || "—"}
                        </span>
                      </TableCell>

                      {/* State */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-medium text-slate-600">
                          {(contact.metadata as any)?.state || "—"}
                        </span>
                      </TableCell>

                      {/* Mobile No */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-medium text-slate-700">{contact.phone || "—"}</span>
                      </TableCell>

                      {/* Email ID */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-medium text-slate-600 truncate max-w-[180px] block">
                          {contact.email || "—"}
                        </span>
                      </TableCell>

                      {/* DP Account No */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-mono text-slate-600">{contact.dematAccountNo || "—"}</span>
                      </TableCell>

                      {/* Bank Account No */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-mono text-slate-600">
                          {contact.accountNumber || contact.clientBankAccountNo || "—"}
                        </span>
                      </TableCell>

                      {/* IFSC Code */}
                      <TableCell className="py-3 border-r border-slate-100/50">
                        <span className="font-mono text-slate-600">
                          {contact.ifscCode || contact.clientIfscCode || "—"}
                        </span>
                      </TableCell>

                      {/* Bank Name */}
                      <TableCell className="py-3 pr-5">
                        <span className="font-medium text-slate-700">{contact.bankName || "—"}</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredContacts.length)}</span> to{" "}
              <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredContacts.length)}</span> of{" "}
              <span className="font-bold text-slate-900">{filteredContacts.length}</span> contacts
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className={cn("cursor-pointer select-none", currentPage <= 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) p = currentPage - 2 + i;
                    if (p > totalPages) p = totalPages - (4 - i);
                  }
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={currentPage === p}
                        onClick={() => setCurrentPage(p)}
                        className="cursor-pointer select-none"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className={cn("cursor-pointer select-none", currentPage >= totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {/* Contact Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(v) => !v && setDetailOpen(false)}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedContact && (
            <>
              {/* Dialog Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md",
                        selectedContact.type === "BANK" ? "bg-blue-500" : "bg-violet-500"
                      )}
                    >
                      {selectedContact.type === "BANK" ? (
                        <Building2 className="h-6 w-6" />
                      ) : (
                        <Users className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900">
                        {selectedContact.name}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            selectedContact.type === "BANK"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-violet-50 text-violet-700"
                          )}
                        >
                          {getContactType(selectedContact)}
                        </span>
                        {selectedContact.code && (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {selectedContact.code}
                          </span>
                        )}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              {/* Details */}
              <div className="px-6 py-5 space-y-4 max-h-[400px] overflow-y-auto">
                {/* Contact Info */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contact Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField icon={Phone} label="Phone" value={selectedContact.phone} />
                    <DetailField icon={Mail} label="Email" value={selectedContact.email} />
                    <DetailField icon={MapPin} label="Address" value={selectedContact.address} colSpan />
                  </div>
                </div>

                {/* Tax Info */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tax & Compliance</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="PAN" value={selectedContact.pan} mono />
                    <DetailField label="GST No" value={selectedContact.gstNo} mono />
                    <DetailField label="TAN No" value={selectedContact.tanNo} mono />
                  </div>
                </div>

                {/* Bank Info */}
                {(selectedContact.bankName || selectedContact.accountNumber || selectedContact.clientBankAccountNo) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="Bank Name" value={selectedContact.bankName} />
                      <DetailField label="Account No" value={selectedContact.accountNumber || selectedContact.clientBankAccountNo} mono />
                      <DetailField label="IFSC Code" value={selectedContact.ifscCode || selectedContact.clientIfscCode} mono />
                    </div>
                  </div>
                )}

                {/* Demat Info */}
                {selectedContact.dematAccountNo && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Demat Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="DP Account No" value={selectedContact.dematAccountNo} mono />
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Account Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Status" value={selectedContact.isActive ? "Active" : "Inactive"} />
                    <DetailField label="Created" value={formatDate(selectedContact.createdAt)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Detail Field Component ──
function DetailField({
  icon: Icon,
  label,
  value,
  mono,
  colSpan,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string | null;
  mono?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div className={cn("bg-slate-50/80 rounded-xl px-3 py-2.5", colSpan && "col-span-2")}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className={cn("text-sm font-semibold text-slate-800", mono && "font-mono")}>
        {value || "—"}
      </p>
    </div>
  );
}
