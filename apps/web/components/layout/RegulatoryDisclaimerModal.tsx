"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const DISCLAIMER_STORAGE_KEY = "unlistedstox_regulatory_disclaimer_accepted_v1";

export function RegulatoryDisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const accepted = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
      if (!accepted) {
        // Small delay to ensure smooth page load
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch {
      // In case localStorage is blocked/disabled
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (!hasAcknowledged) return;
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, JSON.stringify({
        acceptedAt: new Date().toISOString(),
        version: "v1",
      }));
    } catch {
      // Ignore storage errors
    }
    setIsOpen(false);
  };

  if (!isMounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] sm:w-[90vw] sm:max-w-[620px] md:max-w-[650px] max-h-[85dvh] flex flex-col p-4 sm:px-6 sm:py-5 gap-0 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.14)] z-[9999] [&>button]:hidden overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Document with Shield-Check SVG matching mockup */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[#15803D] shrink-0"
            >
              <path
                d="M14 2H7C5.89543 2 5 2.89543 5 4V13"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2L19 7V19C19 20.1046 18.1046 21 17 21H12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2V7H19"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 9H15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M9 12.5H15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M6.5 14.5L9.5 15.7V18.3C9.5 20.2 8.2 21.7 6.5 22.3C4.8 21.7 3.5 20.2 3.5 18.3V15.7L6.5 14.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5.3 18.3L6.2 19.2L7.9 17.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <DialogTitle className="text-base sm:text-[18px] font-bold text-[#0F3D2A] tracking-tight">
              Disclaimer
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close disclaimer"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 rounded-md"
          >
            <X className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </button>
          <DialogDescription className="sr-only">
            Platform regulatory terms and conditions disclaimer
          </DialogDescription>
        </div>

        {/* Body Content - Wide layout keeps paragraphs short in height */}
        <div className="py-3 sm:py-3.5 space-y-2.5 text-[11.5px] sm:text-[12.5px] leading-[1.55] text-slate-600 overflow-y-auto flex-1 text-left overscroll-contain">
          <p>
            This Platform is operated by <strong className="font-semibold text-slate-800">SMC Investech Private Limited</strong> and provides information and connectivity in relation to Unlisted Shares. It is neither a broker, agent, dealer, nor a trading platform, and does not provide exchange-like facilities for trading in securities. The platform does not offer virtual trading, paper trading, fantasy trading or any kind of trading activities, nor does it offer or facilitate investments in unlisted debt securities including bonds, debentures, or other debt instruments.
          </p>
          <p>
            This platform is intended solely for informational and educational purposes. All content, data, pricing indications and valuation-related information are provided for reference only and do not constitute any recommendation, offer, or solicitation to buy or sell any securities. Investors are advised to undertake their own due diligence and seek independent professional advice before making any investment decisions.
          </p>
          <p>
            By submitting your interest to purchase Unlisted Shares through this platform, you acknowledge and agree to the applicable terms and conditions and consent to being contacted by our team regarding availability, price and transaction details. Any transaction, if undertaken, shall be strictly on a principal-to-principal basis between the consenting parties and will be subject to applicable laws, KYC requirements, and completion of necessary documentation.
          </p>
        </div>

        {/* Footer: Soft Green Tinted Checkbox Bar + Action Button */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2.5 shrink-0">
          <label
            htmlFor="regulatory-disclaimer-checkbox"
            className="flex items-center gap-2.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg bg-[#EFF7F3] hover:bg-[#E6F3EC] cursor-pointer select-none transition-colors"
          >
            <Checkbox
              id="regulatory-disclaimer-checkbox"
              checked={hasAcknowledged}
              onCheckedChange={(checked) => setHasAcknowledged(Boolean(checked))}
              className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 rounded-[4px] border-[1.5px] border-[#15803D] bg-white data-[state=checked]:bg-[#15803D] data-[state=checked]:border-[#15803D] transition-colors"
            />
            <span className="text-[11.5px] sm:text-[12.5px] font-medium text-[#134E35] leading-snug">
              I acknowledge and understand this disclaimer.
            </span>
          </label>

          <Button
            type="button"
            onClick={handleAccept}
            disabled={!hasAcknowledged}
            className={`w-full h-9 sm:h-10 rounded-lg text-xs sm:text-[13px] font-semibold transition-all duration-150 ${
              hasAcknowledged
                ? "bg-[#0EA54F] hover:bg-[#0C8F44] text-white shadow-sm cursor-pointer"
                : "bg-[#E2E8F0]/90 text-[#94A3B8] cursor-not-allowed hover:bg-[#E2E8F0]/90"
            }`}
          >
            I Understand &amp; Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
