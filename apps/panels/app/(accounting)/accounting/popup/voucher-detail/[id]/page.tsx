"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, Loader2, AlertCircle, Check, X as CancelIcon, MessageSquare, Edit, RefreshCw, Tag, Receipt, TrendingDown, IndianRupee } from "lucide-react";
import { getOrderByIdAdmin } from "@/lib/orders-api";
import { stocksApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { 
  fetchVoucherById, 
  approveVoucher, 
  remarkVoucher, 
  reverseVoucher,
  fetchLedgers,
  getOrderPricingDetails,
  type Voucher,
  type Ledger
} from "@/lib/accounting-api";
import { useAccountingAdmin } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PAYMENT_SALES: "Sale",
  RECEIPT: "Receipt",
  JOURNAL: "Journal",
};
const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PAYMENT_SALES: "bg-rose-50 text-rose-700",
  RECEIPT: "bg-emerald-50 text-emerald-700",
  JOURNAL: "bg-blue-50 text-blue-700",
};

const formatCurrency = (val: any) => {
  const num = Number(val);
  if (isNaN(num)) return "0.00";
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

const getResolvedVoucherEntryStockDetails = (entry: any, voucher: any) => {
  const metadata = (voucher?.metadata || {}) as any;
  const entryMeta = (entry?.metadata || {}) as any;
  const rawNarr = entry?.narration || voucher?.narration || "";

  let scriptName = entry?.scriptName;
  let isin = entry?.isin;
  let qty = entry?.qty;
  let rate = entry?.rate;

  // 1. If missing, look for ANY entry in the same voucher that has them or attached stock object
  if (!scriptName || scriptName === "—" || !isin || isin === "—") {
    const stockEntry = voucher?.entries?.find((e: any) => e.scriptName && e.scriptName !== "—");
    if (stockEntry) {
      if (!scriptName || scriptName === "—") scriptName = stockEntry.scriptName;
      if (!isin || isin === "—") isin = stockEntry.isin;
    }
  }

  // 1b. Check ledger.stock
  if (!scriptName || scriptName === "—" || !isin || isin === "—") {
    const entryWithLedgerStock = voucher?.entries?.find((e: any) => e.ledger?.stock);
    if (entryWithLedgerStock?.ledger?.stock) {
      if (!scriptName || scriptName === "—") scriptName = entryWithLedgerStock.ledger.stock.name;
      if (!isin || isin === "—") isin = entryWithLedgerStock.ledger.stock.isin;
    }
  }

  // 2. Fallback to metadata / narration matching
  if (!scriptName || scriptName === "—") {
    scriptName =
      metadata.scriptName ||
      metadata.stockName ||
      entryMeta.scriptName ||
      entryMeta.stockName ||
      rawNarr.match(/Payment (?:received )?for ([^—\-\(\)]+)/i)?.[1]?.trim() ||
      rawNarr.match(/Payment for ([^-\(\)]+)/i)?.[1]?.trim() ||
      rawNarr.match(/Purchase of ([^-\(\)]+)/i)?.[1]?.trim() ||
      rawNarr.match(/Sale of ([^-\(\)]+)/i)?.[1]?.trim() ||
      "—";
  }

  if (!isin || isin === "—") {
    isin = metadata.isin || metadata.isinCode || entryMeta.isin || "—";
  }

  // 3. Qty and Rate fallbacks
  if (qty == null) {
    const siblingQty = voucher?.entries?.find((e: any) => e.qty && e.qty > 0)?.qty;
    qty = siblingQty ?? metadata.quantity ?? metadata.qty ?? entryMeta.quantity ?? entryMeta.qty ?? null;
  }
  if (rate == null) {
    const siblingRate = voucher?.entries?.find((e: any) => e.rate && e.rate > 0)?.rate;
    rate = siblingRate ?? metadata.pricePerShare ?? metadata.rate ?? entryMeta.pricePerShare ?? entryMeta.rate ?? null;
  }

  // 4. Mathematical derivation if amount is present
  const entryAmount = entry?.amount || voucher?.totalAmount || 0;
  if (rate && !qty && entryAmount > 0) {
    qty = Math.round(entryAmount / rate);
  } else if (qty && !rate && entryAmount > 0) {
    rate = Number((entryAmount / qty).toFixed(2));
  }

  return {
    scriptName: scriptName || "—",
    isin: isin || "—",
    qty,
    rate,
  };
};

export default function VoucherDetailPopup() {
  const params = useParams();
  const voucherId = params.id as string;
  const router = useRouter();

  const { accountingAdmin } = useAccountingAdmin();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const handleEdit = () => {
    if (!voucher) return;
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = `/accounting/voucher-entry?edit=${voucher.id}`;
      window.close();
    } else {
      router.push(`/accounting/voucher-entry?edit=${voucher.id}`);
    }
  };

  const handleReverse = async () => {
    if (!voucherId) return;
    const confirm = window.confirm(
      "Are you sure you want to reverse this voucher? This will create an equal and opposite accounting voucher against the approved voucher while preserving both transactions for audit purposes."
    );
    if (!confirm) return;

    setActionLoading(true);
    setActionError(null);
    try {
      await reverseVoucher(voucherId);
      // Reload voucher details
      const updated = await fetchVoucherById(voucherId);
      setVoucher(updated);
      // Trigger parent window reload if it exists
      if (window.opener && !window.opener.closed) {
        window.opener.location.reload();
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message || "Failed to reverse voucher");
    } finally {
      setActionLoading(false);
    }
  };

  // Approval actions state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRemarking, setIsRemarking] = useState(false);
  const [remarkText, setRemarkText] = useState("");

  const loadVoucher = useCallback(() => {
    if (voucherId) {
      setLoading(true);
      Promise.all([
        fetchVoucherById(voucherId),
        fetchLedgers("ALL", undefined, false)
      ])
        .then(([v, ledgersResult]) => {
          setVoucher(v);
          setLedgers(ledgersResult.ledgers || []);
          // 1. Resolve stock details from entries, ledgers, metadata, or narration
          const resolvedStock = getResolvedVoucherEntryStockDetails(v?.entries?.[0], v);
          let scriptName = resolvedStock.scriptName !== "—" ? resolvedStock.scriptName : "";
          if (!scriptName) {
            const allNarr = [v?.narration, ...(v?.entries?.map((e: any) => e.narration) || [])].filter(Boolean).join(" ");
            const stockMatch = allNarr.match(/Payment (?:received )?for ([^—\-\(\)]+)/i) || allNarr.match(/Payment for ([^—\-\(\)]+)/i);
            if (stockMatch && stockMatch[1]) {
              scriptName = stockMatch[1].trim();
            }
          }

          // 2. Extract instrument ID (e.g. 6437291252)
          let meta = v?.metadata as any;
          if (typeof meta === "string") {
            try { meta = JSON.parse(meta); } catch {}
          }
          const firstEntryMeta = v?.entries?.[0]?.metadata as any;
          const instrumentId =
            meta?.instrumentId ||
            meta?.bank_reference ||
            meta?.bankReferenceNo ||
            meta?.transactionId ||
            meta?.cashfreePaymentId ||
            firstEntryMeta?.instrumentId ||
            firstEntryMeta?.bank_reference ||
            (v?.referenceNumber && !v.referenceNumber.startsWith("26-") && !v.referenceNumber.startsWith("RCP-") ? v.referenceNumber : undefined);

          // 3. Extract order identifier candidates & metadata discount snapshots
          const allNarr = [v?.narration, ...(v?.entries?.map((e: any) => e.narration) || [])].filter(Boolean).join(" ");
          const narrOrderMatch = allNarr.match(/(?:Order\s*#?\s*)([A-Za-z0-9_-]+)/i);

          const metaOrderId = meta?.orderId || firstEntryMeta?.orderId;
          const metaOrderNumber = meta?.orderNumber || firstEntryMeta?.orderNumber;
          const narrOrder = narrOrderMatch?.[1]?.trim();

          const orderIdentifier =
            metaOrderId ||
            metaOrderNumber ||
            narrOrder ||
            meta?.cashfreeOrderId ||
            "";

          const displayOrderRef = narrOrder
            ? (narrOrder.startsWith("ORD-") ? narrOrder : `ORD-${narrOrder.toUpperCase()}`)
            : (metaOrderNumber || (metaOrderId ? `ORD-${metaOrderId.slice(-10).toUpperCase()}` : (v?.voucherNumber ? `ORD-${v.voucherNumber.replace(/^RCP-?/i, "")}` : "ORD-UNKNOWN")));

          const metaDiscount = meta?.discountApplied != null ? Number(meta.discountApplied) : (firstEntryMeta?.discountApplied != null ? Number(firstEntryMeta.discountApplied) : undefined);
          const metaOriginalTotal = meta?.originalTotalAmount != null ? Number(meta.originalTotalAmount) : (firstEntryMeta?.originalTotalAmount != null ? Number(firstEntryMeta.originalTotalAmount) : undefined);
          const metaCouponId = meta?.couponId || firstEntryMeta?.couponId;
          const metaCouponCode = meta?.couponCode || firstEntryMeta?.couponCode;
          const metaQty = meta?.quantity != null ? Number(meta.quantity) : (firstEntryMeta?.quantity != null ? Number(firstEntryMeta.quantity) : undefined);
          const metaPrice = meta?.pricePerShare != null ? Number(meta.pricePerShare) : (firstEntryMeta?.pricePerShare != null ? Number(firstEntryMeta.pricePerShare) : undefined);

          const extraParams = {
            instrumentId: instrumentId && instrumentId !== "—" ? instrumentId : undefined,
            stockName: scriptName || meta?.stockName || undefined,
            amount: v?.totalAmount ? Number(v.totalAmount) : undefined,
            isin: resolvedStock.isin !== "—" ? resolvedStock.isin : (meta?.isin || undefined),
          };

          setLoadingOrder(true);
          const tryFetchOrder = async () => {
            let foundOrder: any = null;

            // Step 1: Direct lookup with exact orderId from metadata (CUID)
            if (metaOrderId) {
              foundOrder = await getOrderPricingDetails(metaOrderId, extraParams);
              if (!foundOrder) {
                foundOrder = await getOrderByIdAdmin(metaOrderId);
              }
            }

            // Step 2: Lookup with short order reference from narration (e.g. 07BTV6DGNX)
            if (!foundOrder && narrOrder) {
              foundOrder = await getOrderPricingDetails(narrOrder, extraParams);
              if (!foundOrder) {
                foundOrder = await getOrderByIdAdmin(narrOrder);
              }
            }

            // Step 3: Lookup with display order reference (e.g. ORD-07BTV6DGNX)
            if (!foundOrder && displayOrderRef) {
              foundOrder = await getOrderPricingDetails(displayOrderRef, extraParams);
            }

            // Step 4: Fallback search by Cashfree payment / instrument ID
            if (!foundOrder && instrumentId && instrumentId !== "—") {
              foundOrder = await getOrderPricingDetails(instrumentId, extraParams);
            }

            // If backend returned a valid order, augment with any missing voucher metadata snapshots
            if (foundOrder) {
              if (metaDiscount != null && (!foundOrder.discountApplied || Number(foundOrder.discountApplied) === 0)) {
                foundOrder.discountApplied = metaDiscount;
              }
              if (metaOriginalTotal != null && (!foundOrder.originalTotalAmount || Number(foundOrder.originalTotalAmount) === 0)) {
                foundOrder.originalTotalAmount = metaOriginalTotal;
              }
              if (metaCouponCode && (!foundOrder.coupon || !foundOrder.coupon.code)) {
                foundOrder.coupon = { ...(foundOrder.coupon || {}), code: metaCouponCode };
              }
              if (metaCouponId && !foundOrder.couponId) {
                foundOrder.couponId = metaCouponId;
              }
              setOrderDetails(foundOrder);
              return;
            }

            // Fallback: If no order in DB, synthesize audit snapshot directly from voucher metadata + stock catalog
            if (scriptName || v?.totalAmount > 0 || metaDiscount || metaOriginalTotal) {
              let catalogStock: any = null;
              if (scriptName) {
                try {
                  const cleanName = scriptName.replace(/\(MSEI\)|\(Unlisted\)|\s+Ltd\.?|\s+Limited/gi, "").trim();
                  const searchRes = await stocksApi.get(`/stocks?search=${encodeURIComponent(cleanName)}&limit=1`);
                  catalogStock = searchRes.data?.stocks?.[0] || searchRes.data?.[0];
                } catch {}
              }

              const totalPaid = Number(v?.totalAmount || 0);
              const currentStockPrice = catalogStock?.price != null ? Number(catalogStock.price) : (metaPrice || resolvedStock.rate || totalPaid);
              const qty = metaQty || resolvedStock.qty || ((currentStockPrice > 0 && totalPaid >= currentStockPrice) ? Math.max(1, Math.round(totalPaid / currentStockPrice)) : 1);
              const priceAtOrder = metaPrice || resolvedStock.rate || (qty > 0 ? Number((totalPaid / qty).toFixed(2)) : totalPaid);
              
              const calculatedDiscount = metaDiscount != null && metaDiscount > 0
                ? metaDiscount
                : (metaOriginalTotal != null && metaOriginalTotal > totalPaid
                    ? metaOriginalTotal - totalPaid
                    : (currentStockPrice > priceAtOrder ? (currentStockPrice - priceAtOrder) * qty : 0));
              
              const grossTotal = metaOriginalTotal != null && metaOriginalTotal >= totalPaid
                ? metaOriginalTotal
                : (totalPaid + calculatedDiscount);

              setOrderDetails({
                id: `SNAPSHOT-${displayOrderRef}`,
                orderNumber: displayOrderRef,
                quantity: qty,
                pricePerShare: priceAtOrder,
                totalAmount: totalPaid,
                discountApplied: calculatedDiscount,
                originalTotalAmount: grossTotal > 0 ? grossTotal : totalPaid,
                couponId: metaCouponId || undefined,
                couponCode: metaCouponCode || undefined,
                coupon: metaCouponCode ? { code: metaCouponCode } : undefined,
                stock: catalogStock || {
                  name: scriptName || meta?.stockName || "Unlisted Stock Asset",
                  isin: resolvedStock.isin !== "—" ? resolvedStock.isin : (meta?.isin || undefined),
                  price: currentStockPrice,
                },
                isAuditSnapshot: true,
              });
            } else {
              setOrderDetails(null);
            }
          };

          tryFetchOrder()
            .catch(() => setOrderDetails(null))
            .finally(() => setLoadingOrder(false));
        })
        .catch(() => {
          setVoucher(null);
        })
        .finally(() => setLoading(false));
    }
  }, [voucherId]);

  useEffect(() => {
    loadVoucher();
  }, [loadVoucher]);

  const handleApprove = async () => {
    if (!voucherId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await approveVoucher(voucherId);
      // Reload voucher details
      const updated = await fetchVoucherById(voucherId);
      setVoucher(updated);
      // Trigger parent window reload if it exists
      if (window.opener && !window.opener.closed) {
        window.opener.location.reload();
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message || "Failed to approve voucher");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemarkSubmit = async () => {
    if (!voucherId) return;
    if (!remarkText.trim()) {
      setActionError("Remark is required when rejecting/remarking a voucher");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await remarkVoucher(voucherId, remarkText.trim());
      // Reload voucher details
      const updated = await fetchVoucherById(voucherId);
      setVoucher(updated);
      setIsRemarking(false);
      setRemarkText("");
      // Trigger parent window reload if it exists
      if (window.opener && !window.opener.closed) {
        window.opener.location.reload();
      }
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message || "Failed to remark voucher");
    } finally {
      setActionLoading(false);
    }
  };

  const isSuperAdmin = accountingAdmin?.role === "SUPER_ADMIN";
  const hasApprovePermission = accountingAdmin?.permissions?.includes("approve_vouchers") || isSuperAdmin;

  const typeLabel = voucher
    ? (voucher.customType?.name ||
       (voucher.voucherNumber.startsWith("PAY-") ? "Payment" :
        voucher.voucherNumber.startsWith("SAL-") || voucher.voucherNumber.startsWith("INV-") ? "Sale" :
        voucher.voucherNumber.startsWith("PUR-") ? "Purchase" :
        voucher.voucherNumber.startsWith("RCP-") ? "Receipt" :
        voucher.voucherNumber.startsWith("JV-") ? "Journal" :
        VOUCHER_TYPE_LABELS[voucher.type] || voucher.type))
    : "";
  const typeColor = voucher
    ? (voucher.voucherNumber.startsWith("PAY-") ? "bg-blue-50 text-blue-700 border-blue-100" :
       voucher.voucherNumber.startsWith("SAL-") || voucher.voucherNumber.startsWith("INV-") ? "bg-rose-50 text-rose-700 border-rose-100" :
       voucher.voucherNumber.startsWith("PUR-") ? "bg-amber-50 text-amber-700 border-amber-100" :
       voucher.voucherNumber.startsWith("RCP-") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
       voucher.voucherNumber.startsWith("JV-") ? "bg-violet-50 text-violet-700 border-violet-100" :
       VOUCHER_TYPE_COLORS[voucher.type] || "bg-slate-100 text-slate-700")
    : "";
  const hasStockDetails = typeLabel === "Purchase" || typeLabel === "Sale";
  const totalDebit = voucher?.entries?.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0) || 0;
  const totalCredit = voucher?.entries?.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-400">
        <AlertCircle className="h-12 w-12 mb-3" />
        <p className="text-lg font-bold text-slate-500">Voucher not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Voucher Detail</h1>
              <p className="text-sm text-slate-500 mt-0.5 font-mono">
                {voucher.voucherNumber} — {typeLabel}
              </p>
            </div>
            <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ml-4", typeColor)}>
              {typeLabel}
            </span>
          </div>

          {/* Action buttons based on status */}
          <div className="flex items-center gap-3">
            {/* Edit button for PENDING or REMARKED vouchers */}
            {(voucher.status === "PENDING" || voucher.status === "REMARKED") && (
              <Button
                onClick={handleEdit}
                variant="outline"
                className="rounded-xl border-slate-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold gap-1.5 shadow-sm"
                disabled={actionLoading}
              >
                <Edit className="h-4 w-4" />
                Edit Voucher
              </Button>
            )}

            {/* Approval actions for PENDING vouchers */}
            {voucher.status === "PENDING" && hasApprovePermission && !isRemarking && (
              <>
                <Button 
                  onClick={() => setIsRemarking(true)} 
                  variant="outline" 
                  className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold gap-1.5"
                  disabled={actionLoading}
                >
                  <MessageSquare className="h-4 w-4" />
                  Remark / Reject
                </Button>
                <Button 
                  onClick={handleApprove} 
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold gap-1.5 shadow-md"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve Voucher
                </Button>
              </>
            )}

            {/* Reversal action for APPROVED vouchers */}
            {voucher.status === "APPROVED" && !voucher.metadata?.reversedById && !voucher.metadata?.isReversal && (
              <Button
                onClick={handleReverse}
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-semibold gap-1.5 shadow-md"
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reverse Voucher
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-5">
        {/* Action Error */}
        {actionError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700">{actionError}</p>
          </div>
        )}

        {/* Remark Form */}
        {isRemarking && (
          <Card className="p-5 border-rose-100 bg-rose-50/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Disapproval / Change Remark</h3>
              <Button 
                onClick={() => { setIsRemarking(false); setRemarkText(""); setActionError(null); }} 
                variant="ghost" 
                size="sm"
                className="text-slate-500 hover:bg-slate-100 rounded-lg h-7 px-2 font-semibold"
              >
                Cancel
              </Button>
            </div>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Provide details on why this voucher needs remarks or changes..."
              className="w-full min-h-[90px] p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all placeholder:text-slate-400 font-medium"
            />
            <div className="flex justify-end gap-3">
              <Button 
                onClick={handleRemarkSubmit} 
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-semibold gap-1.5"
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Reject/Remark
              </Button>
            </div>
          </Card>
        )}

        {/* Status Audit Trail Banner */}
        <div className={cn(
          "p-4 rounded-2xl border text-sm font-semibold flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm",
          voucher.status === "PENDING" && "bg-amber-50 text-amber-800 border-amber-200/50",
          voucher.status === "APPROVED" && "bg-emerald-50 text-emerald-800 border-emerald-200/50",
          voucher.status === "REMARKED" && "bg-rose-50 text-rose-800 border-rose-200/50"
        )}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2 w-2 rounded-full",
                voucher.status === "PENDING" && "bg-amber-500",
                voucher.status === "APPROVED" && "bg-emerald-500",
                voucher.status === "REMARKED" && "bg-rose-500"
              )} />
              <p className="font-bold">
                Status: {voucher.status}
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Created by Admin: <span className="font-semibold text-slate-700">{voucher.createdByName || voucher.createdById}</span>
              {voucher.createdAt && ` on ${formatDateTime(voucher.createdAt)}`}
            </p>
          </div>
          
          {voucher.status !== "PENDING" && (
            <div className="text-xs text-right space-y-1">
              <p className="text-slate-600 font-semibold">
                Action by Admin: <span className="font-semibold text-slate-800">{voucher.approvedByName || voucher.approvedById}</span>
              </p>
              {voucher.approvedAt && (
                <p className="text-slate-400 font-medium">
                  At: {formatDateTime(voucher.approvedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Reversal Linkage Banners */}
        {voucher.metadata?.reversedById && (
          <div className="p-4 rounded-2xl bg-rose-50/30 border border-rose-200/50 text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertCircle className="h-4 w-4" />
              <p>
                This voucher has been <span className="font-bold uppercase text-xs px-2 py-0.5 bg-rose-100 rounded-md">reversed</span>. All ledger & stock balances are negated.
              </p>
            </div>
            <Button
              onClick={() => window.open(`/accounting/popup/voucher-detail/${voucher.metadata.reversedById}`, "_blank", "width=1000,height=800")}
              size="sm"
              variant="outline"
              className="rounded-lg border-rose-200 text-rose-700 bg-white hover:bg-rose-50 font-bold text-xs"
            >
              View Reversal Entry
            </Button>
          </div>
        )}

        {voucher.metadata?.isReversal && voucher.metadata?.reversedVoucherId && (
          <div className="p-4 rounded-2xl bg-blue-50/30 border border-blue-200/50 text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-blue-800">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              <p>
                This is a <span className="font-bold uppercase text-xs px-2 py-0.5 bg-blue-100 rounded-md">reversal entry</span> generated to negate a posted transaction.
              </p>
            </div>
            <Button
              onClick={() => window.open(`/accounting/popup/voucher-detail/${voucher.metadata.reversedVoucherId}`, "_blank", "width=1000,height=800")}
              size="sm"
              variant="outline"
              className="rounded-lg border-blue-200 text-blue-700 bg-white hover:bg-blue-50 font-bold text-xs"
            >
              View Original Voucher
            </Button>
          </div>
        )}

        {/* Display Reject Remark if exists */}
        {voucher.status === "REMARKED" && voucher.approvalRemark && (
          <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-100/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-1">Disapproval / Audit Remark</p>
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{voucher.approvalRemark}</p>
          </div>
        )}

        {/* Metadata Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {(() => {
            const isStockVoucher = voucher.voucherNumber.startsWith("PUR-") || voucher.voucherNumber.startsWith("SAL-");
            const firstEntry = voucher.entries?.[0];

            // Robust extraction of orderId (prioritize explicit narration order number if present)
            const narrationText = voucher.narration || firstEntry?.narration || "";
            const narrationMatch = narrationText.match(/(?:Order\s*#?\s*)(ORD-[A-Z0-9]+|[A-Z0-9_-]+)/i);

            let orderId = "";
            if (narrationMatch && narrationMatch[1]) {
              const extracted = narrationMatch[1].trim();
              orderId = extracted.startsWith("ORD-") ? extracted : `ORD-${extracted.toUpperCase()}`;
            } else if ((voucher.metadata as any)?.orderNumber) {
              const num = String((voucher.metadata as any).orderNumber);
              orderId = num.startsWith("ORD-") ? num : `ORD-${num.toUpperCase()}`;
            } else if ((firstEntry?.metadata as any)?.orderNumber) {
              const num = String((firstEntry?.metadata as any).orderNumber);
              orderId = num.startsWith("ORD-") ? num : `ORD-${num.toUpperCase()}`;
            } else if ((voucher.metadata as any)?.orderId || (firstEntry?.metadata as any)?.orderId || (voucher.metadata as any)?.cashfreeOrderId) {
              const rawId = String((voucher.metadata as any)?.orderId || (firstEntry?.metadata as any)?.orderId || (voucher.metadata as any)?.cashfreeOrderId);
              if (rawId.startsWith("ORD-")) {
                orderId = rawId;
              } else if (rawId.length > 15) {
                orderId = `ORD-${rawId.slice(-6).toUpperCase()}`;
              } else {
                orderId = `ORD-${rawId.toUpperCase()}`;
              }
            }

            // Robust extraction of orderDate
            const orderDateRaw =
              (voucher.metadata as any)?.orderDate ||
              (firstEntry?.metadata as any)?.orderDate ||
              voucher.referenceDate ||
              voucher.createdAt ||
              voucher.date;

            const orderDate = orderDateRaw ? formatDate(orderDateRaw) : "—";

            // Extraction of Mode of Payment, Instrument ID (Cashfree Bank Ref No) and Instrument Date
            const modeOfPayment =
              (voucher.metadata as any)?.modeOfPayment ||
              (firstEntry?.metadata as any)?.modeOfPayment ||
              "Cashfree";

            const instrumentId =
              (voucher.metadata as any)?.instrumentId ||
              (voucher.metadata as any)?.utrNumber ||
              (voucher.metadata as any)?.bank_reference ||
              (voucher.metadata as any)?.bankReferenceNo ||
              (voucher.metadata as any)?.bankReference ||
              (firstEntry?.metadata as any)?.bank_reference ||
              (firstEntry?.metadata as any)?.bankReference ||
              (firstEntry?.metadata as any)?.bankReferenceNo ||
              (firstEntry?.metadata as any)?.instrumentId ||
              (voucher.metadata as any)?.shareTransferReferenceNo ||
              (voucher.metadata as any)?.transactionId ||
              (voucher.metadata as any)?.cashfreePaymentId ||
              (voucher.referenceNumber && !voucher.referenceNumber.startsWith('ORD-') && !voucher.referenceNumber.startsWith('26') ? voucher.referenceNumber.replace('CHG-', '') : '') ||
              "—";

            const instrumentDateRaw =
              (voucher.metadata as any)?.transactionDate ||
              (voucher.metadata as any)?.cashfreeTransactionDate ||
              (voucher.metadata as any)?.instrumentDate ||
              (firstEntry?.metadata as any)?.transactionDate ||
              (firstEntry?.metadata as any)?.instrumentDate ||
              orderDateRaw;

            const instrumentDate = instrumentDateRaw ? formatDate(instrumentDateRaw) : "—";

            const cards = [
              { label: "Voucher No", value: voucher.voucherNumber },
              { label: "Date", value: formatDate(voucher.date) },
              { 
                label: isStockVoucher ? "Contract Note No" : "Reference No", 
                value: voucher.referenceNumber || "—" 
              },
            ];
            if (voucher.referenceDate) {
              cards.push({
                label: isStockVoucher ? "Contract Note Date" : "Reference Date",
                value: formatDate(voucher.referenceDate)
              });
            }
            if (isStockVoucher || orderId) {
              cards.push({
                label: "Order ID",
                value: orderId || "—"
              });
              cards.push({
                label: "Order Date",
                value: orderDate
              });
            }
            cards.push({
              label: "Mode of Payment",
              value: modeOfPayment
            });
            cards.push({
              label: "Instrument ID",
              value: instrumentId
            });
            cards.push({
              label: "Instrument Date",
              value: instrumentDate
            });
            cards.push({ 
              label: "Total Amount", 
              value: `₹${formatCurrency(voucher.totalAmount)}` 
            });
            return cards.map((m) => (
              <div key={m.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{m.label}</p>
                <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{m.value}</p>
              </div>
            ));
          })()}
        </div>

        {voucher.narration && (
          <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Narration</p>
            <p className="text-sm text-slate-700 font-medium">{voucher.narration}</p>
          </div>
        )}

        {/* Order Pricing & Discount Breakdown Card (Only shown if a discount was given) */}
        {orderDetails && (() => {
          const priceAtOrder = Number(orderDetails.pricePerShare || 0);
          const qty = Number(orderDetails.quantity || 0);
          const netPaid = Number(orderDetails.totalAmount || 0);
          const currentPrice = orderDetails.stock?.price != null ? Number(orderDetails.stock.price) : null;
          const recordedOriginal = orderDetails.originalTotalAmount != null ? Number(orderDetails.originalTotalAmount) : 0;
          let discount = Number(orderDetails.discountApplied || 0);
          if (discount <= 0 && recordedOriginal > netPaid) {
            discount = recordedOriginal - netPaid;
          }

          const hasDiscount = discount > 0 || !!orderDetails.couponId || !!orderDetails.coupon?.code || !!orderDetails.couponCode || (recordedOriginal > netPaid);

          // Don't show this discount banner if no discount was given or provided on this receipt
          if (!hasDiscount) {
            return null;
          }
          
          // Gross total calculation:
          // If a real discount exists (> 0), Gross Total = Net Paid + Discount (or recorded originalTotalAmount >= netPaid)
          // If no discount exists (<= 0), Gross Total = Net Paid (which equals priceAtOrder * qty)
          const calculatedGross = priceAtOrder * qty > 0 ? priceAtOrder * qty : netPaid;
          const originalTotal = discount > 0 
            ? (recordedOriginal >= netPaid 
                ? recordedOriginal 
                : netPaid + discount)
            : (calculatedGross >= netPaid ? calculatedGross : netPaid);

          const priceDiff = currentPrice != null ? currentPrice - priceAtOrder : null;
          const priceDiffPct = currentPrice != null && priceAtOrder > 0 
            ? ((priceDiff! / priceAtOrder) * 100).toFixed(2) 
            : null;

          return (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50/50 px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-800">Order Pricing &amp; Discount Breakdown</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 tracking-wider uppercase">
                  Audit Snapshot
                </span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Stock Name */}
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Stock / Asset</p>
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">
                      {orderDetails.stock?.name || orderDetails.basket?.name || '—'}
                    </p>
                    {orderDetails.stock?.isin && (
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">ISIN: {orderDetails.stock.isin}</p>
                    )}
                  </div>

                  {/* Price Per Share at Order Time */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Price / Share (At Order)</p>
                    <p className="text-lg font-bold text-slate-900 font-mono">₹{formatCurrency(priceAtOrder)}</p>
                    <p className="text-[10px] text-slate-400">Actual unit rate charged</p>
                  </div>

                  {/* Quantity */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Quantity</p>
                    <p className="text-lg font-bold text-slate-900 font-mono">{qty}</p>
                    <p className="text-[10px] text-slate-400">Shares purchased</p>
                  </div>

                  {/* Current Stock Price */}
                  {currentPrice != null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Current Price</p>
                      <p className="text-lg font-bold text-blue-700 font-mono">₹{formatCurrency(currentPrice)}</p>
                      {priceDiff != null && (
                        <p className={cn("text-[10px] font-semibold font-mono", priceDiff > 0 ? "text-emerald-600" : priceDiff < 0 ? "text-rose-600" : "text-slate-400")}>
                          {priceDiff > 0 ? `+${priceDiffPct}%` : priceDiff < 0 ? `${priceDiffPct}%` : "0.00%"} vs order
                        </p>
                      )}
                    </div>
                  )}

                  {/* Order Number */}
                  {orderDetails.orderNumber && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Order Ref</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">{orderDetails.orderNumber}</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: {orderDetails.id?.slice(-8)}</p>
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown Row */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  {/* Original Gross Total */}
                  <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
                    <IndianRupee className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Total</p>
                      <p className="text-sm font-bold font-mono text-slate-800">₹{formatCurrency(originalTotal)}</p>
                    </div>
                  </div>

                  {/* Discount Given */}
                  {discount > 0 ? (
                    <div className="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-4 py-2.5 border border-emerald-200">
                      <TrendingDown className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Discount Given</p>
                        <p className="text-sm font-bold font-mono text-emerald-700">
                          -₹{formatCurrency(discount)}
                          {originalTotal > 0 && (
                            <span className="text-[11px] font-semibold text-emerald-600 ml-1">
                              ({((discount / originalTotal) * 100).toFixed(2)}% off)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-slate-50/70 rounded-xl px-4 py-2.5 border border-slate-150">
                      <Tag className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discount Given</p>
                        <p className="text-sm font-semibold text-slate-500">₹0.00 (No Discount)</p>
                      </div>
                    </div>
                  )}

                  {/* Coupon Badge */}
                  {(orderDetails.couponId || orderDetails.coupon?.code || orderDetails.couponCode) && (
                    <div className="flex items-center gap-2.5 bg-purple-50 rounded-xl px-4 py-2.5 border border-purple-200">
                      <Tag className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Coupon Applied</p>
                        <p className="text-sm font-bold font-mono text-purple-700">
                          {orderDetails.coupon?.code || orderDetails.couponCode || 'COUPON_ACTIVE'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Final Amount Paid */}
                  <div className="flex items-center gap-2.5 bg-blue-50/80 rounded-xl px-4 py-2.5 border border-blue-200 ml-auto">
                    <IndianRupee className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Net Paid (Voucher Total)</p>
                      <p className="text-lg font-bold font-mono text-blue-700">₹{formatCurrency(netPaid)}</p>
                    </div>
                  </div>
                </div>

                {/* Mathematical Equation Pill for Accountant Clarity */}
                <div className="mt-3 px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500">Calculation:</span>
                    <span className="font-mono text-slate-700">
                      {discount > 0 ? (
                        <>
                          {qty} {qty === 1 ? 'share' : 'shares'} × ₹{formatCurrency(priceAtOrder)} = ₹{formatCurrency(originalTotal)} − ₹{formatCurrency(discount)} (discount) ={' '}
                          <span className="font-bold text-blue-700">₹{formatCurrency(netPaid)} Net Paid</span>
                        </>
                      ) : (
                        <>
                          {qty} {qty === 1 ? 'share' : 'shares'} × ₹{formatCurrency(priceAtOrder)} ={' '}
                          <span className="font-bold text-blue-700">₹{formatCurrency(netPaid)} Net Paid</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                    <Check className="h-3.5 w-3.5" />
                    <span>Reconciled with Voucher</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Entries Table */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Entry Lines ({voucher.entries?.length || 0})
          </p>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[1500px]">
              <thead>
                <tr className="bg-slate-100/80">
                  {(hasStockDetails
                    ? ["#", "Ledger Name", "Ledger Code", "Sub Ledger Code", "Sub ledger Name", "Sun Code", "Sun Ledger Name", "Narration", "ISIN", "Script Name", "Qty", "Rate", "Dr/Cr", "Amount"]
                    : ["#", "Ledger Name", "Ledger Code", "Sub Ledger Code", "Sub ledger Name", "Sun Code", "Sun Ledger Name", "Narration", "Dr/Cr", "Amount"]
                  ).map((col) => (
                    <th key={col} className="px-4 py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap border-b border-slate-200">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(voucher.entries || []).map((entry, idx) => {
                  const sunCode = entry.ledger?.sunCode || entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—";
                  const sunLedger = entry.ledger?.sunName || entry.ledger?.name || "—";
                  const mainLedgerCode = entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—";
                  
                  // Resolve sub-ledger: first try metadata.subLedgerId, then fall back
                  // to the counterpart (contra) entries in the same voucher.
                  const subLedgerId = entry.metadata?.subLedgerId;
                  // Only use explicit sub-ledger if it is different from the entry's own ledgerId
                  const subLedger = (subLedgerId && subLedgerId !== entry.ledgerId)
                    ? ledgers.find((l) => l.id === subLedgerId)
                    : null;

                  let subLedgerCode = "—";
                  let subLedgerName = "—";

                  if (subLedger) {
                    subLedgerCode = subLedger.code || subLedger.id?.slice(0, 8) || "—";
                    subLedgerName = subLedger.name || "—";
                  } else {
                    // Fallback: use counterpart entries' ledger codes (contra accounts)
                    const allEntries = voucher.entries || [];
                    const contraEntries = allEntries.filter((e) => e.id !== entry.id);
                    if (contraEntries.length > 0) {
                      subLedgerCode = contraEntries
                        .map((e) => e.ledger?.code || e.ledger?.id?.slice(0, 8) || "")
                        .filter(Boolean)
                        .join(", ") || "—";
                      subLedgerName = contraEntries
                        .map((e) => e.ledger?.name || "")
                        .filter(Boolean)
                        .join(", ") || "—";
                    }
                  }

                  return (
                    <tr key={entry.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{entry.ledger?.name || "—"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{entry.ledger?.type || ""}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{mainLedgerCode}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{subLedgerCode}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{subLedgerName}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{sunCode}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{sunLedger}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{entry.narration || "—"}</td>
                      {hasStockDetails && (() => {
                        const sDetails = getResolvedVoucherEntryStockDetails(entry, voucher);
                        return (
                          <>
                            <td className="px-4 py-3 font-mono text-slate-500">{sDetails.isin}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{sDetails.scriptName}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{sDetails.qty != null ? sDetails.qty : "—"}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{sDetails.rate != null ? formatCurrency(sDetails.rate) : "—"}</td>
                          </>
                        );
                      })()}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                          entry.entryType === "DEBIT" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        )}>
                          {entry.entryType === "DEBIT" ? "Dr" : "Cr"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("font-mono font-bold text-base", entry.entryType === "DEBIT" ? "text-rose-700" : "text-emerald-700")}>
                          ₹{formatCurrency(entry.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-semibold text-slate-600">Total Debit: <span className="text-rose-600 font-bold font-mono text-base">₹{formatCurrency(totalDebit)}</span></span>
            <span className="font-semibold text-slate-600">Total Credit: <span className="text-teal-600 font-bold font-mono text-base">₹{formatCurrency(totalCredit)}</span></span>
          </div>
          <span className={cn("text-sm font-bold px-3 py-1.5 rounded-lg", Math.abs(totalDebit - totalCredit) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
            {Math.abs(totalDebit - totalCredit) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
          </span>
        </div>
      </div>
    </div>
  );
}
