"use client";

import { downloadSignedDealSheet } from "@/lib/orders-api";
import { canRetryOrderPayment, isPaymentExpired, paymentDeadline } from "@/lib/order-payment-window";
import { usePaymentClock } from "@/hooks/use-payment-clock";
import React, { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  Send,
  Building2,
  Download,
  Loader2,
  ExternalLink,
  Package,
  Layers,
  Check,
  Copy,
} from "lucide-react";
import { cn, getBgColor } from "@/lib/utils";
import { OrderStatus, PaymentStatus, type OrderWithStock } from "@/types/order";

interface OrderJourneyDialogProps {
  order: OrderWithStock | null;
  isOpen: boolean;
  onCloseAction: () => void;
  onDownloadInvoiceAction?: (orderId: string, stockName: string, orderNumber?: string) => Promise<void> | void;
  isDownloadingInvoice?: boolean;
}

type StepStatus = "completed" | "current" | "upcoming" | "failed";

interface JourneyStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: StepStatus;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: string | null;
  metadata?: { label: string; value: string }[];
}

export function OrderJourneyDialog({
  order,
  isOpen,
  onCloseAction,
  onDownloadInvoiceAction,
  isDownloadingInvoice = false,
}: OrderJourneyDialogProps) {
  const now = usePaymentClock();
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [downloadingDealSheet, setDownloadingDealSheet] = useState(false);
  const [dealSheetError, setDealSheetError] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  const handleCopyOrderId = () => {
    if (!orderIdDisplay) return;
    navigator.clipboard.writeText(orderIdDisplay);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  const handleDownloadDealSheet = async () => {
    if (!order) return;
    setDownloadingDealSheet(true);
    setDealSheetError(null);
    try {
      await downloadSignedDealSheet(order.id, stockName, order.orderNumber || orderIdDisplay);
    } catch (error: any) {
      setDealSheetError(error.message);
    } finally {
      setDownloadingDealSheet(false);
    }
  };

  if (!order) return null;

  const isCompleted =
    order.status === OrderStatus.COMPLETED ||
    (order.status as any) === "COMPLETED";
  const isPaid =
    order.paymentStatus === PaymentStatus.PAID ||
    (order.paymentStatus as any) === "PAID" ||
    order.status === OrderStatus.PAID ||
    (order.status as any) === "PAID" ||
    isCompleted;
  const isFailed =
    order.paymentStatus === PaymentStatus.FAILED ||
    (order.paymentStatus as any) === "FAILED" ||
    (order.status as any) === "CANCELLED";
  const canPay = canRetryOrderPayment(order, now);
  const expired = isPaymentExpired(order, now);

  const orderIdDisplay =
    order.orderNumber ||
    order.cashfreePaymentId ||
    `ORD-${order.id.slice(0, 8).toUpperCase()}`;

  const stockName =
    order.stock?.name || order.basket?.name || "Unlisted Security";
  const logo = order.stock?.logoUrl || order.basket?.iconUrl;
  const isin = order.stock?.isin || order.stock?.cin || "-";
  const isBasket = Boolean(order.basketId && !order.stockId);

  // Format dates
  const createdDate = new Date(order.createdAt);
  const createdDateFormatted = createdDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updatedDate = new Date(order.updatedAt || order.createdAt);
  const updatedDateFormatted = updatedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDownloadReceipt = async () => {
    try {
      setDownloadingReceipt(true);
      const res = await fetch(`/api/orders/${order.id}/receipt`);
      if (!res.ok) throw new Error("Receipt not available yet");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeStockName = stockName.normalize("NFKD").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
      const safeOrderNumber = (order.orderNumber || orderIdDisplay).normalize("NFKD").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
      a.download = ["Receipt", safeStockName, safeOrderNumber].filter(Boolean).join(" - ") + ".pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download receipt.");
    } finally {
      setDownloadingReceipt(false);
    }
  };

  // Build steps
  const steps: JourneyStep[] = [
    {
      id: "placed",
      title: "Order Placed",
      subtitle: "Order initiated successfully",
      description: `Order created for ${order.quantity} shares of ${stockName} at ₹${(
        order.pricePerShare || order.totalAmount / order.quantity
      ).toLocaleString("en-IN")}/share.`,
      status: "completed",
      icon: Package,
      timestamp: createdDateFormatted,
      metadata: [
        { label: "Order ID", value: orderIdDisplay },
        {
          label: "Total Value",
          value: `₹${order.totalAmount.toLocaleString("en-IN", {
            minimumFractionDigits: order.totalAmount % 1 !== 0 ? 2 : 0,
            maximumFractionDigits: 2,
          })}`,
        },
      ],
    },
    {
      id: "payment",
      title: isPaid
        ? "Payment Confirmed"
        : isFailed
        ? "Payment Failed"
        : "Payment Pending",
      subtitle: isPaid
        ? "Payment successfully received"
        : isFailed
        ? "Payment attempt failed"
        : "Awaiting payment from client",
      description: isPaid
        ? `Payment of ₹${order.totalAmount.toLocaleString(
            "en-IN"
          )} received and reconciled via Cashfree Gateway.`
        : isFailed
        ? "The payment transaction failed or was cancelled. You can retry paying now."
        : "Payment is pending. Please complete payment to reserve inventory and proceed.",
      status: isPaid ? "completed" : isFailed ? "failed" : "current",
      icon: CreditCard,
      timestamp: isPaid ? updatedDateFormatted : undefined,
      metadata: isPaid
        ? [
            ...(order.cashfreePaymentId
              ? [{ label: "Payment Ref", value: order.cashfreePaymentId }]
              : []),
            ...(order.receiptNumber
              ? [{ label: "Receipt No", value: order.receiptNumber }]
              : []),
          ]
        : undefined,
    },
    {
      id: "verification",
      title: "Demat & Compliance Verification",
      subtitle: isPaid
        ? "Client credentials verified"
        : "Pending payment confirmation",
      description: isPaid
        ? "Client Beneficiary Owner (BO) ID, PAN, and depository KYC verified with NSDL/CDSL."
        : "Compliance and depository account verification will begin once payment is confirmed.",
      status: isPaid ? "completed" : "upcoming",
      icon: ShieldCheck,
      timestamp: isPaid ? updatedDateFormatted : undefined,
    },
    {
      id: "transfer",
      title: "Share Transfer Execution",
      subtitle: isCompleted
        ? "Transferred via Depository Batch"
        : isPaid
        ? "In Progress (Takes T+7 Days)"
        : "Awaiting previous steps",
      description: isCompleted
        ? "Delivery Instruction Slip (DIS) processed and batch executed by SMC Depository Participant."
        : isPaid
        ? "Share transfer is currently in progress. Depository share transfers take up to T+7 working days to settle and credit shares to your Demat account."
        : "Physical transfer batch takes T+7 days to be executed via NSDL/CDSL once verification is complete.",
      status: isCompleted ? "completed" : isPaid ? "current" : "upcoming",
      icon: Send,
      metadata: [
        ...(!isCompleted ? [{ label: "Expected Timeline", value: "T+7 Days" }] : []),
        ...((order as any).shareTransferReferenceNo
          ? [
              {
                label: "Transfer Ref",
                value: (order as any).shareTransferReferenceNo,
              },
            ]
          : []),
      ],
    },
    {
      id: "completed",
      title: "Delivered to Demat & Completed",
      subtitle: isCompleted
        ? "Shares credited to your account"
        : "Estimated within T+7 Days",
      description: isCompleted
        ? "Shares have been credited to your Demat account! Your portfolio has been updated, and the official Tax Invoice is ready."
        : "Once depository transfer is finalized within T+7 days, shares will show in your Demat portfolio, and your Tax Invoice will be generated.",
      status: isCompleted ? "completed" : "upcoming",
      icon: Building2,
      timestamp: isCompleted ? updatedDateFormatted : undefined,
      metadata: isCompleted && order.invoiceNumber
        ? [{ label: "Invoice No", value: order.invoiceNumber }]
        : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const hasFooterActions =
    canPay ||
    Boolean(order.esignDocId) ||
    isPaid ||
    Boolean(isCompleted && onDownloadInvoiceAction);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl p-0 overflow-hidden border border-slate-200/90 shadow-2xl rounded-2xl sm:rounded-3xl bg-white max-h-[90vh] flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">{stockName} Order Details</DialogTitle>
        <DialogDescription className="sr-only">Order fulfillment journey for {stockName}</DialogDescription>

        {canPay && <p className="px-5 pt-3 text-xs text-amber-700">Payment pending. Retry before {new Date(paymentDeadline(order)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</p>}
        {expired && <p role="status" className="px-5 pt-3 text-sm text-slate-600">This order has expired. Please place a new order.</p>}
        {/* ── Dialog Header: Clean Light Production Theme ── */}
        <div className="relative px-5 py-5 sm:px-7 sm:py-6 bg-white border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {logo ? (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-50 p-2 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs">
                  <img
                    src={logo}
                    alt={stockName}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold shrink-0 text-white shadow-xs",
                    getBgColor(stockName)
                  )}
                >
                  {stockName.substring(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 line-clamp-1 sm:truncate" title={stockName}>
                    {stockName}
                  </h3>
                  {isBasket && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                      Basket
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                  <span className="truncate max-w-[140px] sm:max-w-none">ISIN: {isin}</span>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    title="Click to copy Order ID"
                    className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 hover:bg-slate-200/70 transition-colors px-1.5 py-0.5 rounded text-[11px] font-medium"
                  >
                    <span>{orderIdDisplay}</span>
                    {copiedOrderId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <div className="shrink-0 self-start sm:self-auto">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  isCompleted
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isPaid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isFailed
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isCompleted
                      ? "bg-emerald-600"
                      : isPaid
                      ? "bg-emerald-600 animate-pulse"
                      : isFailed
                      ? "bg-rose-600"
                      : "bg-amber-600 animate-pulse"
                  )}
                />
                {isCompleted
                  ? "Completed"
                  : isPaid
                  ? "Transfer In Progress"
                  : isFailed
                  ? "Cancelled"
                  : "Payment Pending"}
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar: Clean Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[10px] sm:text-[11px] block font-semibold uppercase tracking-wider">
                Quantity
              </span>
              <span className="text-slate-900 font-bold text-xs sm:text-sm mt-0.5 block">
                {order.quantity.toLocaleString("en-IN")} Shares
              </span>
            </div>
            <div className="bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[10px] sm:text-[11px] block font-semibold uppercase tracking-wider">
                Price / Share
              </span>
              <span className="text-slate-900 font-bold text-xs sm:text-sm mt-0.5 block">
                ₹{(order.pricePerShare ?? (order.totalAmount / order.quantity)).toLocaleString("en-IN", {
                  minimumFractionDigits: (order.pricePerShare ?? (order.totalAmount / order.quantity)) % 1 !== 0 ? 2 : 0,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[10px] sm:text-[11px] block font-semibold uppercase tracking-wider">
                Total Amount
              </span>
              <span className="text-slate-900 font-extrabold text-xs sm:text-sm mt-0.5 block">
                ₹{order.totalAmount.toLocaleString("en-IN", {
                  minimumFractionDigits: order.totalAmount % 1 !== 0 ? 2 : 0,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 text-[10px] sm:text-[11px] block font-semibold uppercase tracking-wider">
                Order Date
              </span>
              <span className="text-slate-700 font-semibold text-xs sm:text-sm mt-0.5 block">
                {createdDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable Journey Steps with subtle scrollbar ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-6 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Order Fulfillment Journey
              </h4>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {completedCount} of {steps.length} steps completed
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Timeline Container */}
          <div className="relative pl-5 sm:pl-6 space-y-6 sm:space-y-7 before:absolute before:left-[13px] sm:before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;

              const isStepCompleted = step.status === "completed";
              const isStepCurrent = step.status === "current";
              const isStepFailed = step.status === "failed";
              const isStepUpcoming = step.status === "upcoming";

              return (
                <div key={step.id} className="relative group">
                  {/* Step Dot / Icon */}
                  <div
                    className={cn(
                      "absolute -left-[22px] sm:-left-[24px] top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-xs",
                      isStepCompleted &&
                        "bg-emerald-600 text-white ring-4 ring-emerald-50",
                      isStepCurrent &&
                        (step.id === "payment"
                          ? "bg-amber-500 text-white ring-4 ring-amber-50"
                          : "bg-emerald-600 text-white ring-4 ring-emerald-50 animate-pulse"),
                      isStepFailed &&
                        "bg-rose-600 text-white ring-4 ring-rose-50",
                      isStepUpcoming &&
                        "bg-white text-slate-400 border border-slate-200"
                    )}
                  >
                    {isStepCompleted ? (
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    ) : isStepFailed ? (
                      <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="ml-4 sm:ml-5 min-w-0">
                    <div className="flex items-start sm:items-baseline justify-between gap-1.5 sm:gap-2 flex-col sm:flex-row">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h5
                          className={cn(
                            "text-[13px] sm:text-sm font-semibold tracking-tight",
                            isStepCompleted && "text-slate-900",
                            isStepCurrent && "text-slate-900",
                            isStepFailed && "text-rose-700",
                            isStepUpcoming && "text-slate-400"
                          )}
                        >
                          {step.title}
                        </h5>
                        {isStepCurrent && (
                          <span
                            className={cn(
                              "text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border",
                              step.id === "payment"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}
                          >
                            {step.id === "payment" ? "Action Needed" : "In Progress • Takes T+7 Days"}
                          </span>
                        )}
                        {isStepCompleted && idx === 0 && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Done
                          </span>
                        )}
                      </div>

                      {step.timestamp && (
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-400">
                          {step.timestamp}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-[11px] sm:text-xs mt-1 leading-relaxed",
                        isStepUpcoming ? "text-slate-400" : "text-slate-600 font-normal"
                      )}
                    >
                      {step.description}
                    </p>

                    {/* Prominent T+7 Days Notice on Share Transfer In Progress */}
                    {step.id === "transfer" && isStepCurrent && (
                      <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-medium text-[11px] leading-tight">
                          Depository share transfer takes <strong className="font-bold text-amber-950">T+7 working days</strong> to settle and reflect in your Demat account.
                        </span>
                      </div>
                    )}

                    {/* Metadata Chips if any */}
                    {step.metadata && step.metadata.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2.5">
                        {step.metadata.map((meta, mIdx) => (
                          <div
                            key={mIdx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-[10px] sm:text-[11px] font-medium text-slate-700 font-mono break-all"
                          >
                            <span className="text-slate-400 font-sans font-normal text-[10px]">
                              {meta.label}:
                            </span>
                            <span className="font-semibold text-slate-800">{meta.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Delivery Notice */}
          <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-xs text-slate-600 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs sm:text-[13px]">
                SMC Depository Settlement Guarantee (T+7 Days)
              </p>
              <p className="mt-0.5 text-slate-500 leading-relaxed text-[11px]">
                All shares are transferred securely into your CDSL/NSDL Demat account via official off-market DIS / depository batch within T+7 working days. Once completed, your share balance will reflect directly in your Demat holding statement.
              </p>
            </div>
          </div>
        </div>

        {/* ── Modal Footer with Document Actions ── */}
        {dealSheetError && <p role="alert" className="px-5 py-2 text-xs text-rose-600 font-medium bg-rose-50 border-t border-rose-100">{dealSheetError}</p>}
        {hasFooterActions && (
          <div className="px-5 py-3.5 sm:px-7 sm:py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            {/* Pay Now Button (if unpaid) */}
            {canPay && (
              <Button
                asChild
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs px-4 h-9"
              >
                <Link href={`/orders/${order.id}`}>Retry Payment</Link>
              </Button>
            )}

            {order.esignDocId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadDealSheet}
                disabled={downloadingDealSheet}
                className="text-xs rounded-xl gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium h-9 px-3.5"
              >
                {downloadingDealSheet ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                )}
                {downloadingDealSheet ? "Downloading..." : "Download signed deal sheet"}
              </Button>
            )}

            {/* Receipt Download (if paid) */}
            {isPaid && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReceipt}
                disabled={downloadingReceipt}
                className="border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium text-xs rounded-xl gap-1.5 h-9 px-3.5"
              >
                {downloadingReceipt ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="hidden xs:inline">Download Receipt</span>
                <span className="xs:hidden">Receipt</span>
              </Button>
            )}

            {/* Invoice Download (if completed) */}
            {isCompleted && onDownloadInvoiceAction && (
              <Button
                size="sm"
                onClick={() => onDownloadInvoiceAction(order.id, stockName, order.orderNumber || orderIdDisplay)}
                disabled={isDownloadingInvoice}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs gap-1.5 px-4 h-9"
              >
                {isDownloadingInvoice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-white" />
                )}
                <span className="hidden xs:inline">Download Invoice</span>
                <span className="xs:hidden">Invoice</span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
