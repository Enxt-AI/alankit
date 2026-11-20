"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { StockDetail } from "@/lib/stocks-data";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const detailTabs = ["Overall", "About", "News", "Q&A"] as const;
type DetailTab = (typeof detailTabs)[number];

type NewsArticle = {
  id: string;
  title: string;
  date: string;
};

function getStockNews(ticker: string): {
  leftCol: NewsArticle[];
  rightCol: NewsArticle[];
} {
  return {
    leftCol: [
      {
        id: "n1",
        title:
          "Nifty 50 & Sensex Expected to Rally Today, Check Top Indian Stock Picks for Monday",
        date: "January 7, 2025",
      },
      {
        id: "n2",
        title: `${ticker} Performance Supported by Strong Q3 Earnings and Retail Expansion Across India`,
        date: "January 10, 2025",
      },
      {
        id: "n3",
        title:
          "Touching New Highs Last Week, See Indian Unlisted Market & Nifty Projections for Monday",
        date: "January 12, 2025",
      },
      {
        id: "n4",
        title: `Here Are Analyst Recommendations for ${ticker}, NSE, HDBFIN, and NSDL Today`,
        date: "January 14, 2025",
      },
    ],
    rightCol: [
      {
        id: "n5",
        title: `Ahead of Pre-IPO Filing, Institutional Demand Surges for ${ticker} and Tata Group Shares`,
        date: "January 18, 2025",
      },
      {
        id: "n6",
        title:
          "Check Indian Unlisted Stock Valuations and Sensex Outlook for Today's Session",
        date: "January 21, 2025",
      },
      {
        id: "n7",
        title: "Watch Top Indian Financial & Tech Stocks Recommended by Analysts This Week",
        date: "January 24, 2025",
      },
      {
        id: "n8",
        title: `Check Target Prices for ${ticker}, RELIANCE, HDFCBANK, and TCS for Tuesday Trading`,
        date: "January 25, 2025",
      },
    ],
  };
}

function getStockFaqs(stock: StockDetail) {
  return [
    {
      id: "q1",
      question: `What is the current market capitalization of ${stock.ticker} stock?`,
      answer: `The current market capitalization of ${stock.name} (${stock.ticker}) is ${stock.stats.marketCap} ${stock.stats.marketCapCurrency || stock.currency}.`,
    },
    {
      id: "q2",
      question: `What is the P/E (Price-to-Earnings) ratio of ${stock.ticker} stock?`,
      answer: `${stock.ticker} currently trades at a Price-to-Earnings (P/E) ratio of ${stock.stats.peRatio} with a Basic EPS of ${stock.stats.basicEps} ${stock.stats.basicEpsCurrency || stock.currency}.`,
    },
    {
      id: "q3",
      question: `What is the 52-week high of ${stock.ticker} stock?`,
      answer: `The highest price reached by ${stock.ticker} in the last 52 weeks is 940 ${stock.currency}.`,
    },
    {
      id: "q4",
      question: `What is the 52-week low of ${stock.ticker} stock?`,
      answer: `The lowest price recorded by ${stock.ticker} in the last 52 weeks is 450 ${stock.currency}.`,
    },
    {
      id: "q5",
      question: `What is the price target for ${stock.ticker} stock?`,
      answer: `Analyst consensus rates ${stock.ticker} as "${stock.analystRating.label}" with technical indicators suggesting "${stock.technicalRating.label}".`,
    },
    {
      id: "q6",
      question: `Does ${stock.ticker} stock pay dividends?`,
      answer: `${
        stock.stats.dividendYield !== "0.00%"
          ? `Yes, ${stock.ticker} pays dividends with a current dividend yield of ${stock.stats.dividendYield}.`
          : `${stock.ticker} currently has a reported dividend yield of 0.00%.`
      }`,
    },
  ];
}

export function StockDetailsSections({ stock }: { stock: StockDetail }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("Overall");
  const [showMoreStats, setShowMoreStats] = useState(false);
  const [readMoreAbout, setReadMoreAbout] = useState(false);
  const [showAllNews, setShowAllNews] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const newsColumns = getStockNews(stock.ticker);
  const faqs = getStockFaqs(stock);

  return (
    <div className="mt-10 space-y-10">
      {/* 1. Key statistics (Translated from "Statistik kunci") */}
      <ScrollReveal variant="fade-up">
        <h2 className="text-xl font-normal tracking-tight text-zinc-900 sm:text-2xl">
          Key statistics
        </h2>

        <div className="mt-5 rounded-xl border border-zinc-200/80 bg-white p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            {/* Row 1 */}
            <div>
              <p className="text-xs text-zinc-500">Market capitalization</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.marketCap}{" "}
                {stock.stats.marketCapCurrency && (
                  <span className="text-xs font-normal text-zinc-500">
                    {stock.stats.marketCapCurrency}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Dividend yield</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.dividendYield}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Basic EPS</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.basicEps}{" "}
                {stock.stats.basicEpsCurrency && (
                  <span className="text-xs font-normal text-zinc-500">
                    {stock.stats.basicEpsCurrency}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Price to earnings ratio</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.peRatio}
              </p>
            </div>

            {/* Row 2 */}
            <div>
              <p className="text-xs text-zinc-500">Net income</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.netIncome}{" "}
                {stock.stats.netIncomeCurrency && (
                  <span className="text-xs font-normal text-zinc-500">
                    {stock.stats.netIncomeCurrency}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Revenue</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.revenue}{" "}
                {stock.stats.revenueCurrency && (
                  <span className="text-xs font-normal text-zinc-500">
                    {stock.stats.revenueCurrency}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Shares float</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.sharesFloat}{" "}
                {stock.stats.sharesFloatCurrency && (
                  <span className="text-xs font-normal text-zinc-500">
                    {stock.stats.sharesFloatCurrency}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Beta (1Y)</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {stock.stats.beta}
              </p>
            </div>

            {showMoreStats && (
              <>
                <div>
                  <p className="text-xs text-zinc-500">52W High</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    940{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      {stock.currency}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">52W Low</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    450{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      {stock.currency}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Average Volume (30D)</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    3.12M
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Price / Book</p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">2.45</p>
                </div>
              </>
            )}
          </div>

          {/* See More Link (Translated from "Lihat Selengkapnya") */}
          <button
            type="button"
            onClick={() => setShowMoreStats((prev) => !prev)}
            className="mt-6 inline-block text-xs font-medium text-[#2563EB] underline underline-offset-4 hover:text-[#1D4ED8] cursor-pointer"
          >
            {showMoreStats ? "See Less" : "See More"}
          </button>
        </div>
      </ScrollReveal>

      {/* 2. Section Filter Tabs (Translated from Keseluruhan / Tentang / Berita / Pertanyaan Jawaban) */}
      <ScrollReveal variant="fade-up" delayMs={80}>
        <div className="flex flex-wrap items-center gap-2">
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-lg px-4 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </ScrollReveal>

      {/* 3. About the Company (Translated from "Tentang Perusahaan") */}
      {(activeTab === "Overall" || activeTab === "About") && (
        <ScrollReveal variant="fade-up" delayMs={140}>
          <h2 className="text-xl font-normal tracking-tight text-zinc-900 sm:text-2xl">
            About the Company
          </h2>

          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-zinc-700">
            {stock.companyProfile.about}
            {readMoreAbout && stock.companyProfile.aboutExtended}
          </p>

          {/* Read More Link (Translated from "Baca Selengkapnya") */}
          <button
            type="button"
            onClick={() => setReadMoreAbout((prev) => !prev)}
            className="mt-3 inline-block text-xs font-medium text-[#2563EB] underline underline-offset-4 hover:text-[#1D4ED8] cursor-pointer"
          >
            {readMoreAbout ? "Read Less" : "Read More"}
          </button>

          {/* Company Metadata Card: Sector, Industry, CEO, Website */}
          <div className="mt-6 rounded-xl border border-zinc-200/80 bg-white p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Sector</p>
                <p className="mt-2 text-xs sm:text-sm font-normal text-zinc-900">
                  {stock.companyProfile.sector}
                </p>
              </div>

              <div>
                <p className="text-xs text-zinc-500">Industry</p>
                <p className="mt-2 text-xs sm:text-sm font-normal text-zinc-900">
                  {stock.companyProfile.industry}
                </p>
              </div>

              <div>
                <p className="text-xs text-zinc-500">CEO</p>
                <p className="mt-2 text-xs sm:text-sm font-normal text-zinc-900">
                  {stock.companyProfile.ceo}
                </p>
              </div>

              <div>
                <p className="text-xs text-zinc-500">Website</p>
                <a
                  href={`https://${stock.companyProfile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block truncate text-xs sm:text-sm font-normal text-zinc-900 hover:text-[#2563EB] transition-colors"
                >
                  {stock.companyProfile.website}
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* 4. News Section (Translated from "Berita") */}
      {(activeTab === "Overall" || activeTab === "News") && (
        <ScrollReveal variant="fade-up" delayMs={180}>
          <h2 className="text-xl font-normal tracking-tight text-zinc-900 sm:text-2xl">
            News
          </h2>

          <div className="mt-5 rounded-xl border border-zinc-200/80 bg-white p-6">
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              {/* Left Column of News */}
              <div className="divide-y divide-zinc-100">
                {newsColumns.leftCol.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 group cursor-pointer"
                  >
                    <div className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-[#FF1F00]">
                      <span className="text-sm font-black italic tracking-tighter text-white">
                        {stock.logoText || "ACE"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-xs font-medium leading-snug text-zinc-900 group-hover:text-[#2563EB] transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        {item.date}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* Right Column of News */}
              <div className="divide-y divide-zinc-100 border-t border-zinc-100 mt-4 pt-4 md:border-t-0 md:mt-0 md:pt-0">
                {newsColumns.rightCol.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 group cursor-pointer"
                  >
                    <div className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-[#FF1F00]">
                      <span className="text-sm font-black italic tracking-tighter text-white">
                        {stock.logoText || "ACE"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-xs font-medium leading-snug text-zinc-900 group-hover:text-[#2563EB] transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        {item.date}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* See All Link (Translated from "Lihat Semua") */}
            <button
              type="button"
              onClick={() => setShowAllNews((prev) => !prev)}
              className="mt-6 inline-block text-xs font-medium text-[#2563EB] underline underline-offset-4 hover:text-[#1D4ED8] cursor-pointer"
            >
              {showAllNews ? "Show Less" : "See All"}
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* 5. Questions & Answers Accordion Section (Translated from "Pertanyaan Jawaban") */}
      {(activeTab === "Overall" || activeTab === "Q&A") && (
        <ScrollReveal variant="fade-up" delayMs={220}>
          <h2 className="text-xl font-normal tracking-tight text-zinc-900 sm:text-2xl">
            Questions &amp; Answers
          </h2>

          <div className="mt-5 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
            {faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="px-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 py-4.5 text-left text-xs sm:text-sm font-normal text-zinc-900 hover:text-[#2563EB] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="pb-4 text-xs leading-relaxed text-zinc-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
