"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingContent } from "@/components/landing/landing-content";
import TickerTape from "@/components/layout/TickerTape";
import { HeroCta } from "@/components/layout/sections/HeroCta";
import Testimonials from "@/components/layout/sections/Testimonials";
import { Button } from "@/components/ui/button";
import { FaqAccordion } from "@/components/support/faq-accordion";
import { MobileFaqSection } from "@/components/support/mobile-faq-section";
import { useAuthStore } from "@/store/auth-store";
import {
  RiCheckboxCircleFill,
  RiGlobalLine,
  RiLineChartLine,
  RiSearch2Line,
  RiMoneyDollarCircleLine,
  RiShieldCheckLine,
  RiBankCardLine,
  RiCustomerService2Line,
  RiBuilding2Line,
  RiBuilding4Line,
  RiRocket2Line,
  RiErrorWarningFill,
  RiArrowRightSLine,
  RiTimeLine,
  RiWallet3Line,
} from "react-icons/ri";
import { useStocks } from "@/hooks/use-stocks";
import { StockList } from "@/components/stocks/stock-list";
import { HomeNewsSection } from "./HomeNewsSection";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stock, UpcomingStock } from "@/types/stock";
import { generateSlug, getStockSlug } from "@/lib/utils";
import { StepsOnbaord } from "./StepsOnbaord";
import TrendingNow from "@/components/layout/sections/TrendingNow";

export default function HomeClient() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const { data: stocks, isLoading, isError, error, refetch } = useStocks();

  const handleStockClick = (
    stock: Stock | UpcomingStock,
    stockType?: "regular" | "upcoming",
  ) => {
    if (stockType === "upcoming") {
      router.push(`/upcoming-stocks/${stock.id}`);
      return;
    }
    router.push(`/stocks/${getStockSlug(stock)}`);
  };

  // Static content data (omitted for brevity in summary, but fully included in file)
  const comparisonData = [
    {
      feature: "Liquidity",
      publicText: "Actively traded on stock exchanges with higher liquidity",
      unlistedText:
        "Best suited for investors with a medium-to-long-term investment horizon",
    },
    {
      feature: "Regulation",
      publicText: "Governed by SEBI regulations and stock exchange rules",
      unlistedText:
        "Structured under company law & private share transfer framework",
    },
    {
      feature: "Price Movement",
      publicText: "Influenced by daily market sentiment",
      unlistedText:
        "Prices are driven by demand, company performance and valuation",
    },
    {
      feature: "Growth Stage",
      publicText: "Established businesses",
      unlistedText:
        "Opportunity to invest in companies before they are publicly listed",
    },
    {
      feature: "Opportunity Access",
      publicText: "Available post-IPO",
      unlistedText: "Access before IPO launch",
    },
  ];

  const section2 = [
    {
      title: "Create An Account",
      description: "Sign Up, Complete your KYC",
      imageSrc: "/steps/step-1.png",
    },
    {
      title: "Select & buy shares",
      description: "Choose from our curated shares.",
      imageSrc: "/steps/step-2.png",
    },
    {
      title: "See it in your account",
      description:
        "Share added to both your Unlistedstox Money portfolio and demat account.",
      imageSrc: "/steps/step-3.png",
    },
  ];

  const features = [
    { text: "Curated Opportunities", icon: RiSearch2Line },
    { text: "Transparent Pricing", icon: RiMoneyDollarCircleLine },
    { text: "Secure Off-Market Transfers", icon: RiShieldCheckLine },
    { text: "Direct Credit to Your Demat", icon: RiBankCardLine },
    { text: "Dedicated Relationship Support", icon: RiCustomerService2Line },
    { text: "Backed by SMC Group Legacy & Trust", icon: RiBuilding2Line },
  ];

  return (
    <>
      <LandingContent>
        <TickerTape />
        <HeroCta />

        {/* User Banners */}
        {isAuthenticated && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6 mb-4">
            {(!user || isAuthLoading) && (
              <div className="flex items-center justify-between p-4 sm:p-5 bg-white border border-gray-200/80 rounded-2xl shadow-sm animate-pulse">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-3.5 w-64 max-w-xs" />
                  </div>
                </div>
                <Skeleton className="hidden sm:block h-10 w-36 rounded-xl" />
              </div>
            )}

            {!isAuthLoading && user?.kycStatus === "PENDING" && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20">
                      <RiErrorWarningFill className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                          Action Required: Complete KYC
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 font-normal mt-0.5 leading-relaxed">
                        To start investing, we need to verify your identity. It
                        only takes a few minutes.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/kyc"
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-amber-600/20 hover:shadow-amber-600/30 transition-all shrink-0 w-full sm:w-auto"
                  >
                    Complete KYC Now
                    <RiArrowRightSLine className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}

            {!isAuthLoading &&
              user?.kycStatus === "VERIFIED" &&
              user?.dematStatus === "PENDING" &&
              !user?.dematData?.submittedAt && (
                <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 ring-1 ring-indigo-500/20">
                        <RiWallet3Line className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            Link Your Demat Account
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-normal mt-0.5 leading-relaxed">
                          Congratulations on verifying your KYC! Link your demat
                          account now to receive allocated stocks.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/demat"
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all shrink-0 w-full sm:w-auto"
                    >
                      Link Demat Account
                      <RiArrowRightSLine className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}

            {!isAuthLoading &&
              user?.kycStatus === "VERIFIED" &&
              user?.dematStatus === "PENDING" &&
              Boolean(user?.dematData?.submittedAt) && (
                <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/20">
                        <RiTimeLine className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            Demat Verification in Progress
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-normal mt-0.5 leading-relaxed">
                          We are currently verifying your demat details.
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold rounded-xl shrink-0">
                      <RiTimeLine className="h-4 w-4" />
                      Estimated time: 1-2 working days
                    </div>
                  </div>
                </div>
              )}

            {!isAuthLoading &&
              user?.kycStatus === "VERIFIED" &&
              user?.dematStatus === "VERIFIED" &&
              user?.bankStatus === "PENDING" &&
              !user?.bankData?.submittedAt && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20">
                        <RiBankCardLine className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            Add Your Bank Account
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-normal mt-0.5 leading-relaxed">
                          Link your bank account to enable seamless payments and
                          payouts for your investments.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/bank"
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all shrink-0 w-full sm:w-auto"
                    >
                      Add Bank Account
                      <RiArrowRightSLine className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}

            {!isAuthLoading &&
              user?.kycStatus === "VERIFIED" &&
              user?.dematStatus === "VERIFIED" &&
              user?.bankStatus === "PENDING" &&
              Boolean(user?.bankData?.submittedAt) && (
                <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 via-white to-teal-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-teal-500/20">
                        <RiTimeLine className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                            Bank Verification Pending
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-normal mt-0.5 leading-relaxed">
                          We are currently verifying your bank account details.
                          This typically takes 1-2 working days.
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-50 border border-teal-200/80 text-teal-700 text-xs font-semibold rounded-xl shrink-0">
                      <RiTimeLine className="h-4 w-4" />
                      Estimated time: 24-48 hours
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Stock Listing */}
        <section className="relative py-12 md:py-20">
          <div className="w-full px-4">
            <div className="rounded-3xl md:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
                  Featured Stocks
                </h2>
                <Link
                  href="/stocks"
                  className="text-sm font-bold text-green-600 hover:text-green-700 hover:underline transition-colors"
                >
                  View All
                </Link>
              </div>

              <StockList
                stocks={(stocks ?? []).filter((s) => s.isPopular === true)}
                isLoading={isLoading}
                isError={isError}
                error={error as any}
                onStockClick={handleStockClick}
                onRetry={refetch}
                stockType="regular"
                isCarouselOnMobile={true}
              />
            </div>
          </div>
        </section>

        {/* Market Movers */}
        <section className="py-12 md:py-20">
          <TrendingNow />
        </section>

        {!isAuthenticated && (
          <>
            {/* Comparison Section */}
            <section className="relative overflow-hidden bg-white py-12 md:py-20">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
                <div className="text-center mb-8 sm:mb-20">
                  <h2 className="font-outfit text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
                    Public Markets vs{" "}
                    <span className="relative z-10">
                      <span className="relative z-10 text-green-600">
                        Unlisted Shares
                      </span>
                    </span>
                  </h2>
                </div>

                {/* Desktop View (Overlapping Cards) */}
                <div className="max-w-5xl mx-auto relative hidden lg:flex flex-row items-stretch justify-center gap-8">
                  {/* Left Card - Public Markets */}
                  <div className="w-[48%] bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col relative">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Public Markets
                      </span>
                    </div>

                    <h3 className="text-3xl font-extrabold text-gray-900 mb-3">
                      Public Markets
                    </h3>
                    <p className="text-gray-400 text-lg mb-8 mr-4 leading-relaxed">
                      Trade established businesses actively on stock exchanges
                    </p>

                    <div className="w-full h-px bg-gray-100 mb-8"></div>

                    <div className="space-y-5 mb-10 flex-1">
                      {comparisonData.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <RiCheckboxCircleFill className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-600 text-[15px]">
                            {item.publicText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Card - Early Access (Unlisted) */}
                  <div className="w-[48%] bg-white rounded-2xl border-2 border-green-600 p-8 flex flex-col relative shadow-xl">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Unlisted Shares
                      </span>
                    </div>

                    <h3 className="text-3xl font-extrabold text-gray-900 mb-3">
                      Unlisted Shares
                    </h3>
                    <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                      Gain access to early-stage growth before IPO participation
                    </p>

                    <div className="w-full h-px bg-gray-100 mb-8"></div>

                    <div className="space-y-5 mb-10 flex-1">
                      {comparisonData.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <RiCheckboxCircleFill className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                          <span className="text-gray-700 font-medium text-[15px]">
                            {item.unlistedText}
                          </span>
                        </div>
                      ))}
                    </div>

                    <Button
                      asChild
                      className="w-full py-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-all hover:shadow-lg"
                    >
                      <Link href="/login">
                        Open an account{" "}
                        <RiArrowRightSLine className="ml-1 w-5 h-5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Mobile View (List View Style) */}
                <div className="max-w-md mx-auto lg:hidden flex flex-col gap-4">
                  {/* Public Markets List Item */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-4">
                    <div className="flex gap-4 items-start">
                      <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center shadow-sm">
                        <RiBuilding4Line className="w-7 h-7 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-gray-900 text-base">
                            Public Markets
                          </h3>
                          <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold rounded-full text-gray-500 uppercase">
                            Standard
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-snug">
                          Trade established businesses actively on stock
                          exchanges
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-3 space-y-2.5">
                      {comparisonData.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <RiCheckboxCircleFill className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-600 leading-tight">
                            {item.publicText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Early Access List Item */}
                  <div className="bg-white rounded-xl border-2 border-green-500 shadow-md p-4 flex flex-col gap-4 relative overflow-hidden">
                    {/* Subtle background glow */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full blur-xl -z-10"></div>

                    <div className="flex gap-4 items-start">
                      <div className="w-14 h-14 rounded-xl bg-green-50 border border-green-100 flex-shrink-0 flex items-center justify-center shadow-sm">
                        <RiRocket2Line className="w-7 h-7 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-gray-900 text-base">
                            Early Access
                          </h3>
                          <span className="px-2 py-0.5 bg-green-100 text-[10px] font-bold rounded-full text-green-700 uppercase">
                            Unlisted
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-snug">
                          Gain access to early-stage growth before IPO
                          participation
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-green-50 pt-3 space-y-2.5">
                      {comparisonData.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <RiCheckboxCircleFill className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-xs font-medium text-gray-700 leading-tight">
                            {item.unlistedText}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <Button
                        asChild
                        className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm text-sm"
                      >
                        <Link href="/login">
                          Open an account{" "}
                          <RiArrowRightSLine className="ml-1 w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {!isAuthenticated && (
          <section className="py-6 sm:py-12 md:py-20">
            {/* How It Works */}
            <StepsOnbaord />
          </section>
        )}

        {/* News & Articles Section */}
        <HomeNewsSection />

        {/* Testimonials */}
        <section className="py-8 md:py-20">
          <Testimonials />
        </section>

        {/* FAQ */}
        <section className="py-8 md:py-20">
          {/* FAQ — mobile grouped accordion */}
          <div className="lg:hidden">
            <MobileFaqSection />
          </div>

          {/* FAQ — desktop tabs */}
          <div className="hidden lg:block px-10 text-left">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">
              Frequently Asked Questions
            </h2>
            <FaqAccordion />
          </div>
        </section>
      </LandingContent>
    </>
  );
}
