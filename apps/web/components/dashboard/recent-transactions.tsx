"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useMyOrders } from "@/hooks/use-orders";
import { useUserSellRequests } from "@/hooks/use-sell-requests";
import { useMyTransactions } from "@/hooks/use-transactions";
import { useMemo } from "react";

function getBgColor(name: string) {
  const colors = [
    "bg-slate-800 text-white",
    "bg-green-100 text-green-700",
    "bg-pink-100 text-pink-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getVoucherTypeLabel(voucherType: string): string {
  const map: Record<string, string> = {
    PAYMENT_SALES: 'Payment',
    RECEIPT: 'Receipt',
    CREDIT_NOTE: 'Refund',
    DEBIT_NOTE: 'Debit Note',
    JOURNAL: 'Journal',
    STOCK_JOURNAL: 'Stock Adj.',
  };
  return map[voucherType] || voucherType;
}

export function RecentTransactions() {
  const { data: orders, isLoading: isLoadingOrders } = useMyOrders();
  const { data: sellRequests, isLoading: isLoadingSells } = useUserSellRequests();
  const { data: txData, isLoading: isLoadingTx } = useMyTransactions();

  const isLoading = isLoadingOrders || isLoadingSells || isLoadingTx;

  const transactions = useMemo(() => {
    const allTx: any[] = [];
    const safeOrders = orders || [];

    safeOrders.forEach((o: any) => {
      allTx.push({
        id: o.id,
        name: o.stock?.name || o.basket?.name || "Unknown",
        type: "Buy",
        amount: o.totalAmount,
        date: new Date(o.createdAt),
        _source: 'order',
      });
    });

    if (sellRequests) {
      sellRequests.forEach((s: any) => {
        allTx.push({
          id: s.id,
          name: s.stock?.name || "Unknown",
          type: "Sell",
          amount: s.quantity * (s.expectedPrice || s.stock?.price || 0),
          date: new Date(s.createdAt),
          _source: 'sell',
        });
      });
    }

    // Include voucher transactions (refunds, payments received, etc.)
    if (txData?.voucherTransactions) {
      const orderIds = new Set(safeOrders.map((o: any) => o.id));
      const orderRefs = new Set(
        safeOrders.flatMap((o: any) => [o.id, o.cashfreePaymentId, o.orderNumber]).filter(Boolean)
      );

      txData.voucherTransactions.forEach((v: any) => {
        // Exclude vouchers tied to an existing order to prevent duplicates
        const meta = v.metadata as any;
        if (meta?.orderId && orderIds.has(meta.orderId)) return;
        if (v.referenceNumber && orderRefs.has(v.referenceNumber)) return;
        if (v.voucherType === 'RECEIPT' && (meta?.orderId || meta?.type === 'receipt')) return;

        // Parse stock name from narration if scriptName is not available
        let name = v.scriptName || '';
        if (!name && v.narration) {
          const match = v.narration.match(/(?:Payment for|Refund for|Credit for|Debit for)\s+(.+?)(?:\s*-\s*Order|\s*$)/i);
          if (match) name = match[1].trim();
          else name = v.narration.substring(0, 30);
        }
        if (!name) name = v.voucherNumber || 'Voucher';

        const isCredit = v.entryType === 'CREDIT';
        const typeLabel = getVoucherTypeLabel(v.voucherType);

        allTx.push({
          id: v.id,
          name,
          type: isCredit ? typeLabel : typeLabel,
          amount: v.amount,
          date: new Date(v.date || v.createdAt),
          _source: 'voucher',
          isCredit,
        });
      });
    }

    return allTx
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
  }, [orders, sellRequests, txData]);

  return (
    <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl col-span-1 h-full">
      <CardHeader className="flex flex-row items-center justify-between md:p-5 p-4">
        <CardTitle className="md:text-[14px] text-xs font-bold tracking-tight text-slate-900">
          Recent Transactions
        </CardTitle>
        <Link href="/dashboard/orders" className="md:text-xs text-[11px] font-semibold text-green-600 hover:text-green-700">
          View all
        </Link>
      </CardHeader>
      
      <CardContent className="md:px-5 md:pb-5 px-4 pb-4 space-y-6">
        {isLoading ? (
          <div className="text-center text-sm text-slate-500 py-8 animate-pulse">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">
            No recent transactions
          </div>
        ) : (
          transactions.map((tx) => {
            const initial = tx.name.charAt(0).toUpperCase();
            const colorClass = getBgColor(tx.name);

            // Color logic: Buy = green, Sell = red, Voucher credit = blue, Voucher debit = orange
            let typeBadgeClass = 'bg-[#e6f5ea] text-green-700';
            if (tx.type === 'Sell') {
              typeBadgeClass = 'bg-red-50 text-red-600';
            } else if (tx._source === 'voucher') {
              typeBadgeClass = tx.isCredit
                ? 'bg-blue-50 text-blue-700'
                : 'bg-orange-50 text-orange-600';
            }

            return (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`md:w-8 md:h-8 w-7 h-7 rounded-lg flex items-center justify-center font-bold md:text-xs text-[11px] shrink-0 ${colorClass}`}>
                    {initial}
                  </div>
                  <span className="md:text-xs text-[11px] font-medium text-slate-700 truncate w-[80px]" title={tx.name}>{tx.name}</span>
                </div>
                
                <div className={`px-2.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${typeBadgeClass}`}>
                  {tx.type}
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="md:text-xs text-[11px] font-bold text-slate-900">
                    {tx._source === 'voucher' && tx.isCredit ? '+' : ''}₹ {tx.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                    {tx.date.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
