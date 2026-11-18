"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, Compass } from "lucide-react";

interface LegalFallbackProps {
  title: string;
}

export default function LegalFallback({ title }: LegalFallbackProps) {
  return (
    <div className="min-h-screen bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/legal-policies"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-600 transition-colors duration-200"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Legal &amp; Policies
          </Link>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-12 shadow-sm text-center">
          <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Compass className="h-8 w-8 text-emerald-600 animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
            {title}
          </h1>
          
          <p className="text-slate-600 text-[15px] leading-relaxed max-w-lg mx-auto mb-8">
            We&apos;re currently preparing this document. It will be published here shortly. 
            In the meantime, feel free to explore our other policies or reach out to us if you have any questions.
          </p>

          <Link
            href="/legal-policies"
            className="inline-flex items-center justify-center px-6 py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 hover:bg-emerald-700 transition-all duration-200"
          >
            View All Policies
          </Link>
        </div>

      </div>
    </div>
  );
}
