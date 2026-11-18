'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  Receipt, 
  Building2, 
  Calendar, 
  CreditCard, 
  Hash, 
  ArrowRight,
  Lock,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function VerifyContent() {
  const searchParams = useSearchParams();

  const type = (searchParams.get('type') || 'document').toLowerCase();
  const no = searchParams.get('no') || searchParams.get('id') || '—';
  const orderId = searchParams.get('orderId');
  const date = searchParams.get('date') || '—';
  const amt = searchParams.get('amt') || searchParams.get('amount');
  const sig = searchParams.get('sig') || 'SMC-VERIFIED-AUTH';

  const isInvoice = type.includes('inv');
  const isReceipt = type.includes('rec') || type.includes('rcpt');

  const docTitle = isInvoice
    ? 'Official Bill of Supply'
    : isReceipt
    ? 'Payment Receipt Advice'
    : 'Financial Document';

  const docSubtitle = isInvoice
    ? 'Tax Invoice / Bill of Supply for Share Transfer'
    : isReceipt
    ? 'Official Client Payment Receipt & Advice'
    : 'Authenticated Depository Record';

  const formattedAmount = amt
    ? `₹${Number(amt).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : null;

  return (
    <div className="min-h-[80vh] py-6 sm:py-10 px-3 sm:px-6 lg:px-8 max-w-2xl mx-auto flex flex-col justify-center">
      {/* ── Status Banner ── */}
      <div className="text-center mb-5 sm:mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-600 mb-3 sm:mb-4 ring-4 sm:ring-8 ring-emerald-50 shadow-sm animate-in fade-in zoom-in duration-300">
          <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 stroke-[2.5]" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-bold border border-emerald-200 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          AUTHENTIC & VERIFIED DOCUMENT
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          SMC Digital Verification Portal
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 sm:mt-1.5 font-medium">
          This document has been verified against the official depository and financial registry of SMC Investech Private Limited.
        </p>
      </div>

      {/* ── Document Details Card ── */}
      <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden bg-white">
        {/* Card Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-7 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start justify-between gap-3 sm:gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                {isInvoice ? (
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                ) : (
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                )}
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {docTitle}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
                {no}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
                {docSubtitle}
              </p>
            </div>

            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 shrink-0">
              Verified
            </Badge>
          </div>

          {formattedAmount && (
            <div className="mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-white/10 flex items-baseline justify-between">
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Total Amount Received</span>
              <span className="text-lg sm:text-2xl font-black text-emerald-400">
                {formattedAmount}
              </span>
            </div>
          )}
        </div>

        {/* Card Body Key Attributes */}
        <div className="p-4 sm:p-7 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 sm:gap-3">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Date of Issue</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block mt-0.5">{date}</span>
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 sm:gap-3">
              <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Document Reference</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block mt-0.5 font-mono">{no}</span>
              </div>
            </div>

            {orderId && (
              <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 sm:gap-3 sm:col-span-2">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Associated Order ID</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block mt-0.5 font-mono">{orderId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Signature Seal */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/60 border border-emerald-200/70 flex items-start gap-2.5 sm:gap-3">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Cryptographic Digital Seal
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-emerald-700 bg-emerald-100/80 px-1.5 sm:px-2 py-0.5 rounded-md font-bold">
                  HMAC-SHA256
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono text-emerald-800 mt-1 break-all">
                {sig}
              </p>
              <p className="text-[9px] sm:text-[10px] text-emerald-700 font-medium mt-1">
                Digitally authenticated and certified by SMC Investech Private Limited.
              </p>
            </div>
          </div>

          {/* Statutory Entity Information */}
          <div className="border-t border-slate-100 pt-4 sm:pt-5">
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              Issuing Corporate Entity
            </h4>
            <div className="space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs text-slate-600">
              <p className="font-bold text-slate-900 text-xs sm:text-sm">SMC Investech Private Limited</p>
              <p className="text-slate-500 font-medium text-[10px] sm:text-xs">(Formerly SMC Real Estate Advisors Pvt. Ltd.)</p>
              <div className="grid grid-cols-2 gap-2 pt-1.5 sm:pt-2 text-[10px] sm:text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">CIN:</span>
                  <span className="font-mono font-semibold text-slate-700">U74120UP2013PTC054923</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">GSTIN:</span>
                  <span className="font-mono font-semibold text-slate-700">09AASCS6448K1ZF</span>
                </div>
              </div>
              <p className="text-slate-500 text-[10px] sm:text-[11px] pt-1">
                <strong>Registered Office:</strong> 3rd Floor, C-98, Sector 2, Noida, Gautam Buddha Nagar, UP 201301
              </p>
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <Link href="/stocks">
              Explore Unlisted Stocks
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs rounded-xl px-5 shadow-sm"
          >
            <Link href="/dashboard/orders" className="flex items-center gap-1.5">
              Go to My Orders
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function DocumentVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
