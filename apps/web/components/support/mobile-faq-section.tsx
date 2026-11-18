'use client';

/**
 * MobileFaqSection
 * Inspired design: grouped category accordion → nested question accordion
 * Mobile only (md:hidden). No submit button.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicFaqs } from '@/hooks/use-faqs';
import { useIsStandalone } from '@/hooks/use-is-standalone';
import { FaqCategory } from '@/types/faq';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_ORDER: FaqCategory[] = ['General', 'Investing', 'Support'];

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  General: 'General related questions:',
  Investing: 'Investing related questions:',
  Support: 'Support related questions:',
};

export function MobileFaqSection() {
  const { data: faqs = [], isLoading } = usePublicFaqs();
  const { isStandalone, isMounted } = useIsStandalone();

  // Which category group is open
  const [openCategory, setOpenCategory] = useState<FaqCategory | null>('General');
  // Which question is open (per category)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  // Group by category
  const grouped = faqs.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<FaqCategory, typeof faqs>);

  const availableCategories = CATEGORY_ORDER.filter(
    (cat) => grouped[cat]?.some((f) => f.isActive !== false)
  );

  // Hide completely in PWA or native Android app
  if (isMounted && isStandalone) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-400">Loading FAQs…</span>
      </div>
    );
  }

  if (!availableCategories.length) return null;

  return (
    <div className="w-full px-5 sm:px-6 py-6 md:hidden">
      {/* Title */}
      <h2 className="text-lg font-extrabold text-[#1A2530] leading-tight mb-4">
        Frequently Asked Questions:
      </h2>

      {/* Category groups */}
      <div className="flex flex-col gap-2">
        {availableCategories.map((cat) => {
          const isCatOpen = openCategory === cat;
          const activeQuestions = grouped[cat].filter((f) => f.isActive !== false);

          return (
            <div key={cat} className="rounded-xl overflow-hidden border border-slate-200/70">
              {/* Category header */}
              <button
                type="button"
                onClick={() => {
                  setOpenCategory(isCatOpen ? null : cat);
                  setOpenQuestion(null);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors duration-200',
                  isCatOpen
                    ? 'bg-slate-100/80 rounded-t-xl'
                    : 'bg-slate-100/70 rounded-xl'
                )}
              >
                <span className="text-xs font-bold text-slate-800">
                  {CATEGORY_LABELS[cat]}
                </span>
                <motion.div
                  animate={{ rotate: isCatOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                </motion.div>
              </button>

              {/* Questions list */}
              <AnimatePresence initial={false}>
              {isCatOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="bg-white border-t border-slate-100 rounded-b-xl divide-y divide-slate-100 overflow-hidden"
                >
                  {activeQuestions.map((faq, idx) => {
                    const faqKey = faq.id || faq.title || `faq-${idx}`;
                    const isQOpen = openQuestion === faqKey;
                    return (
                      <div key={faqKey}>
                        {/* Question row */}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenQuestion(isQOpen ? null : faqKey)
                          }
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                        >
                          <span className="text-xs text-slate-700 font-medium pr-2 leading-snug">
                            {faq.title}
                          </span>
                          <motion.div
                            animate={{ rotate: isQOpen ? 180 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                          >
                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                          </motion.div>
                        </button>

                        {/* Answer */}
                        <AnimatePresence initial={false}>
                        {isQOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-3.5 pb-3 pt-0.5">
                              {faq.answer.split('\n').map((para, i) => (
                                <p
                                  key={i}
                                  className="text-[11px] text-slate-500 leading-relaxed mb-1 last:mb-0"
                                >
                                  {para}
                                </p>
                              ))}
                            </div>
                          </motion.div>
                        )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
