"use client";

/**
 * Lead detail popup opened by clicking a user's name in the leads table.
 * Shows client info, KYC/access dates, first & last PAID transactions,
 * totals and -branch vs distributor channel split.
 */

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLeadDetail } from "@/hooks/use-marketing-stats";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadDetailTransaction } from "@/lib/marketing-api";

interface LeadDetailDialogProps {
  leadId: string | null;
  onClose: () => void;
}

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

function formatINR(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-neutral-200/40 bg-[#FAFBFC] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
        {label}
      </span>
      <span className="break-words text-sm font-bold text-[#0F172A]">
        {value ?? "—"}
      </span>
    </div>
  );
}

function TransactionSection({
  title,
  txn,
}: {
  title: string;
  txn: LeadDetailTransaction;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Date" value={formatDateOnly(txn.date)} />
        <Field label="Share Name" value={txn.shareName || "—"} />
        <Field
          label="Quantity"
          value={
            txn.quantity !== null && txn.quantity !== undefined
              ? txn.quantity.toLocaleString()
              : "—"
          }
        />
        <Field label="Revenue" value={formatINR(txn.revenue)} />
        <Field label="Source" value={txn.source || "—"} />
        <Field label="Source Details" value={txn.sourceDetails || "—"} />
      </div>
    </div>
  );
}

export default function LeadDetailDialog({
  leadId,
  onClose,
}: LeadDetailDialogProps) {
  const { data: detail, isLoading, isError } = useLeadDetail(leadId);

  return (
    <Dialog
      open={!!leadId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-xl border border-neutral-200/40 bg-white shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base font-bold text-[#0F172A]">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[#ECFDF5] text-[#16A34A] text-sm font-bold">
                {(detail?.clientName || "L").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate">
                {detail ? detail.clientName : "Lead Details"}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] font-medium text-[#64748B]">
                {detail ? `#${detail.clientId}` : "Loading…"}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <span className="ml-3 text-sm text-[#64748B] font-semibold">
                Loading lead details...
              </span>
            </div>
          )}

          {isError && (
            <div className="text-sm font-semibold text-red-600 py-8 text-center">
              Failed to load lead details. Please try again.
            </div>
          )}

          {detail && (
            <div className="space-y-5">
              {/* Client */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Client
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <Field
                    label="Client ID"
                    value={
                      <span className="font-mono text-xs">
                        {detail.clientId}
                      </span>
                    }
                  />
                  <Field label="Client Name" value={detail.clientName} />
                  <Field label="Email" value={detail.maskedEmail || "—"} />
                  <Field label="Phone" value={detail.maskedPhone || "—"} />
                  <Field
                    label="Created On (First Login)"
                    value={formatDateOnly(detail.createdOn)}
                  />
                  <Field
                    label="Last Login (DD/MM/YYYY)"
                    value={formatDateTime(detail.lastLoginAt)}
                  />
                  <Field
                    label="KYC Completed On"
                    value={formatDateOnly(detail.kycCompletedOn)}
                  />
                </div>
              </div>

              <TransactionSection
                title="First Transaction (Paid)"
                txn={detail.firstTransaction}
              />
              <TransactionSection
                title="Last Transaction (Paid)"
                txn={detail.lastTransaction}
              />

              {/* Totals */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Totals
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field
                    label="Transactions Completed"
                    value={detail.totalTransactionsCompleted.toLocaleString()}
                  />
                  <Field
                    label="Total Revenue"
                    value={formatINR(detail.totalRevenue)}
                  />
                  <Field
                    label="Transactions Failed"
                    value={detail.totalTransactionsFailed.toLocaleString()}
                  />
                  <Field
                    label="All Attempted"
                    value={detail.allTransactionsAttempted.toLocaleString()}
                  />
                </div>
              </div>

              {/* Channel split */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                  Channel Split (Paid)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field
                    label="Branch Revenue"
                    value={formatINR(detail.branchRevenue)}
                  />
                  <Field
                    label="Branch Transactions"
                    value={detail.branchTransactions.toLocaleString()}
                  />
                  <Field
                    label="Distributor Revenue"
                    value={formatINR(detail.distributorRevenue)}
                  />
                  <Field
                    label="Distributor Transactions"
                    value={detail.distributorTransactions.toLocaleString()}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
