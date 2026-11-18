"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Shield,
  PieChart,
  HeadphonesIcon,
} from "lucide-react";
import Image from "next/image";
import { ChartBackground } from "../../ui/chart-background";
import { useAuthStore } from "@/store/auth-store";

export function HeroCta() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="relative w-full overflow-hidden bg-[#f5f5f7] pt-8 sm:pt-16 pb-14 sm:pb-16 flex flex-col items-center">
      {/* Background patterns - white and green chart illustration */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
        {/* Bull illustration positioned exactly to the left of the phone */}
        <div className="absolute right-1/2 mr-[180px] sm:mr-[250px] md:mr-[380px] lg:mr-[420px] top-[15%] md:top-[50%] w-[250px] sm:w-[250px] md:w-[350px] lg:w-[450px] h-[300px] md:h-[300px] opacity-[0.04] lg:opacity-[0.05]">
          <Image
            src="/bull.png"
            alt="Bull illustration"
            fill
            className="object-contain object-right"
            priority
          />
        </div>

        {/* Soft radial green glow */}
        <div className="absolute w-[800px] h-[400px] sm:w-[1200px] sm:h-[600px] bg-green-500/10 rounded-[100%] blur-[80px] bottom-[-20%] scale-150" />
        <ChartBackground />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 flex flex-col items-center text-center max-w-7xl mx-auto">
        {/* Sub-brand text */}
        <div className="mb-3 sm:mb-4 flex items-center justify-center">
          <span className="text-[10px] sm:text-[12px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
            Powered by SMC Investech
          </span>
        </div>

        {/* Heading - Single line on tablet, laptop & desktop screens */}
        <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-[46px] xl:text-[54px] 2xl:text-[60px] font-bold leading-[1.15] tracking-tight text-[#1a1a1a] mb-4 sm:mb-6 sm:whitespace-nowrap">
          Invest in Pre-IPO{" "}
          <span className="text-slate-400 font-bold text-[0.75em] mx-1 sm:mx-1.5">
            &amp;
          </span>{" "}
          <span className="text-green-600 block sm:inline mt-1 sm:mt-0">
            Unlisted Shares
          </span>
        </h1>

        {/* Subtitle */}
        <p className={`font-outfit text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl mx-auto ${isAuthenticated ? "mb-8 sm:mb-12" : "mb-6"}`}>
          Get early access to India's top companies before they go public
        </p>

        {/* CTAs */}
        {!isAuthenticated && (
          <div className="flex flex-row items-center justify-center w-full mb-10 sm:mb-20">
            <Button
              size="default"
              className="w-auto px-4 sm:px-8 h-10 sm:h-12 bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all duration-300 text-sm sm:text-base rounded-md sm:rounded-lg font-medium"
              asChild
            >
              <Link href="/login">
                Open an Account Today
              </Link>
            </Button>
          </div>
        )}

        {/* Devices Composition */}
        <div className="relative w-full max-w-[1000px] mx-auto flex justify-center h-[350px] sm:h-[300px] md:h-[350px] lg:h-[400px] xl:h-[440px] mb-8 mt-2">
          {/* MOBILE ONLY: Just the iPhone */}
          <div className="sm:hidden absolute top-0 flex justify-center origin-top transform scale-[0.55] z-20">
            <div className="device device-iphone-14-pro device-spacegray">
              <div className="device-frame">
                <div className="device-screen bg-gray-900 w-full h-full text-left relative overflow-hidden flex items-center justify-center">
                  {/* Replace this src with your actual iPhone dashboard image */}
                  <Image
                    src="/images/hero/phone-mockup.png"
                    alt="UnlistedSTOX Mobile App"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
              <div className="device-stripe"></div>
              <div className="device-header"></div>
              <div className="device-sensors"></div>
              <div className="device-btns"></div>
              <div className="device-power"></div>
            </div>
          </div>

          {/* DESKTOP/TABLET: MacBook + iPhone overlapping */}
          <div className="hidden sm:flex absolute top-0 justify-center origin-top transform scale-[0.65] md:scale-[0.75] lg:scale-[0.85] xl:scale-[0.95] z-20">
            {/* MacBook Pro - devices.css uses default width of ~740px */}
            <div className="device device-macbook-pro device-spacegray !shadow-none">
              <div className="device-frame">
                <div className="device-screen bg-gray-900 flex overflow-hidden w-full h-full text-left relative items-center justify-center">
                  {/* Replace this src with your actual MacBook dashboard image */}
                  <Image
                    src="/images/hero/mockup.png"
                    alt="UnlistedSTOX Desktop Dashboard"
                    fill
                    className="object-fit"
                    priority
                  />
                </div>
              </div>
              <div className="device-stripe"></div>
              <div className="device-header"></div>
              <div className="device-sensors"></div>
              <div className="device-btns"></div>
              <div className="device-power"></div>
            </div>

            {/* iPhone 14 Pro overlapping - devices.css uses default width of ~320px */}
            <div className="device device-iphone-14-pro device-spacegray absolute -left-12 -bottom-2 origin-bottom-left transform scale-[0.35] z-30">
              <div className="device-frame">
                <div className="device-screen bg-gray-900 w-full h-full text-left relative overflow-hidden flex items-center justify-center">
                  {/* Replace this src with your actual iPhone dashboard image */}
                  <Image
                    src="/images/hero/phone-mockup.png"
                    alt="UnlistedSTOX Mobile App"
                    fill
                    className="object-fit"
                    priority
                  />
                </div>
              </div>
              <div className="device-stripe"></div>
              <div className="device-header"></div>
              <div className="device-sensors"></div>
              <div className="device-btns"></div>
              <div className="device-power"></div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-5xl mx-auto grid grid-cols-4 gap-2 sm:gap-8 z-30 mt-8 pt-8 border-t border-gray-200/60 relative bg-white/40 backdrop-blur-md rounded-3xl p-2 sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-base font-bold text-gray-900 mb-1 sm:mb-1.5 leading-tight">
              Secure & Trusted
            </h4>
            <p className="hidden sm:block text-[9px] sm:text-sm text-gray-500 leading-tight sm:leading-relaxed">
              Bank-grade security for your investments
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-base font-bold text-gray-900 mb-1 sm:mb-1.5 leading-tight">
              Diverse Opportunities
            </h4>
            <p className="hidden sm:block text-[9px] sm:text-sm text-gray-500 leading-tight sm:leading-relaxed">
              Access curated unlisted investment opportunities
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-base font-bold text-gray-900 mb-1 sm:mb-1.5 leading-tight">
              Data-Driven Insights
            </h4>
            <p className="hidden sm:block text-[9px] sm:text-sm text-gray-500 leading-tight sm:leading-relaxed">
              Make informed decisions with real-time data
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 mb-2 sm:mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <HeadphonesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h4 className="text-[10px] sm:text-base font-bold text-gray-900 mb-1 sm:mb-1.5 leading-tight">
              Expert Support
            </h4>
            <p className="hidden sm:block text-[9px] sm:text-sm text-gray-500 leading-tight sm:leading-relaxed">
              Get help from our investment experts anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
    >
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}
