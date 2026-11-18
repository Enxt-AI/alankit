"use client";

import { useMemo } from "react";
import Link from "next/link";
import { HelpCircle, Sparkles, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { useFaqs } from "@/hooks/use-faqs";
import { getDefaultStockFaqs } from "@/lib/faqs-api";
import type { Stock } from "@/types/stock";
import type { Faq } from "@/types/faq";

interface StockFaqSectionProps {
  stock: Stock;
  className?: string;
}

export function StockFaqSection({ stock, className }: StockFaqSectionProps) {
  // Fetch CMS FAQs linked to this specific stock
  const { data: cmsFaqs } = useFaqs({ stockId: stock.id });

  // Generate dynamic, data-driven fallback FAQs tailored to this exact stock
  const defaultStockFaqs = getDefaultStockFaqs({
    id: stock.id,
    name: stock.name,
    price: stock.price,
    minimumPurchaseQuantity: stock.minimumPurchaseQuantity,
    maximumPurchaseQuantity: stock.maximumPurchaseQuantity,
    cin: stock.cin,
    isin: stock.isin,
  });

  // Combine custom CMS FAQs and default FAQs (avoid duplicates by matching title)
  const allFaqs = useMemo<Array<Faq & { isCustom?: boolean }>>(() => {
    const activeCms = (cmsFaqs || []).filter((f) => f.isActive !== false);
    const existingTitles = new Set(activeCms.map((f) => f.title.trim().toLowerCase()));

    const customItems = activeCms.map((f) => ({ ...f, isCustom: true }));
    const defaultItems = defaultStockFaqs
      .filter((df) => !existingTitles.has(df.title.trim().toLowerCase()))
      .map((f) => ({ ...f, isCustom: false }));

    return [...customItems, ...defaultItems];
  }, [cmsFaqs, defaultStockFaqs]);

  return (
    <section className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7 ${className || ""}`}>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-2 sm:gap-0 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <HelpCircle className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base sm:text-[18px] font-bold text-slate-900 font-sans tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Everything you need to know about investing in {stock.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
            <MessageCircleQuestion className="h-3 w-3 text-slate-500" />
            {allFaqs.length} FAQs
          </span>
        </div>
      </div>

      {/* Quick answers table — machine-extractable facts about this stock */}
      <table className="w-full border-collapse border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden mb-6 sm:mb-8 text-xs sm:text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
            <th className="px-4 py-3 text-left border-b border-slate-200">Attribute</th>
            <th className="px-4 py-3 text-left border-b border-slate-200">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">Current price</td>
            <td className="px-4 py-3">₹{stock.price.toLocaleString("en-IN")} per share</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">Minimum order</td>
            <td className="px-4 py-3">
              {stock.minimumPurchaseQuantity || 1} share{(stock.minimumPurchaseQuantity || 1) !== 1 ? "s" : ""}{stock.maximumPurchaseQuantity ? ` (max ${stock.maximumPurchaseQuantity})` : ""}
            </td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">Sector</td>
            <td className="px-4 py-3">{stock.category?.name || "—"}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">CIN</td>
            <td className="px-4 py-3 font-mono">{stock.cin || "—"}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">ISIN</td>
            <td className="px-4 py-3 font-mono">{stock.isin || "—"}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="px-4 py-3 font-medium text-slate-900">Status</td>
            <td className="px-4 py-3">
              {stock.isActive ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              ) : (
                <span className="text-red-600 font-medium">Inactive</span>
              )}
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-medium text-slate-900">Last updated</td>
            <td className="px-4 py-3">
              {new Date(stock.updatedAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* FAQ list — always in DOM via native <details>, no JS required */}
      <div className="w-full divide-y divide-slate-100">
        {allFaqs.map((faq, index) => (
          <details
            key={faq.id || `faq-${index}`}
            className="border-b border-slate-100 last:border-0"
          >
            <summary
              className="flex items-center justify-between py-3.5 text-xs sm:text-[14px] font-semibold text-slate-800 hover:text-emerald-700 cursor-pointer list-none"
            >
              <span className="flex-1 flex items-center gap-2">
                <span>{faq.title}</span>
                {faq.isCustom && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded shrink-0">
                    <Sparkles className="h-2.5 w-2.5" />
                    Verified
                  </span>
                )}
              </span>
              <span className="shrink-0 text-slate-400">▾</span>
            </summary>
            <div className="text-xs sm:text-[13.5px] text-slate-600 leading-relaxed font-normal pt-2 pb-4 pr-2 px-4">
              <div
                className="prose prose-sm max-w-none text-slate-600"
                dangerouslySetInnerHTML={{ __html: faq.answer }}
              />
            </div>
          </details>
        ))}
      </div>

      {/* Footer Support CTA */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/70 -mx-5 -mb-5 sm:-mx-7 sm:-mb-7 p-4 sm:p-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Have a question not listed here? Our support team is here to assist.</span>
        </div>
        <Link
          href="/supports"
          className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 transition-colors shrink-0"
        >
          Contact Support
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
