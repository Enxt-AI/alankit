"use client";

/**
 * KYCReminderPopup Component
 * 
 * Bottom-right positioned popup reminding users to complete KYC
 * Appears 5 seconds after dashboard load if KYC is pending
 * Dismissible for the current page load
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export function KYCReminderPopup() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  // Reminder should only appear when the user needs to take action.
  // - PENDING + no submittedAt: user has not submitted yet.
  // - REJECTED: user must restart and resubmit.
  const needsKycAction =
    user?.kycStatus === 'REJECTED' ||
    user?.kycStatus === 'PENDING';

  useEffect(() => {
    // Only proceed if the user actually needs to take action.
    if (!needsKycAction) {
      return;
    }

    // Show popup after 5 seconds delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [needsKycAction]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleCompleteKYC = () => {
    // KYC flow lives at /kyc.
    router.push('/kyc');
  };

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible]);

  // Don't render if not visible or user doesn't need action.
  if (!isVisible || !needsKycAction) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 animate-in slide-in-from-bottom-5 duration-300"
      role="alertdialog"
      aria-label="KYC verification reminder"
    >
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/90 bg-white/95 backdrop-blur-xl p-5 shadow-[0_20px_50px_rgba(245,158,11,0.2)]">
        <button
          onClick={handleDismiss}
          className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          aria-label="Dismiss reminder"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3.5 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/25 ring-4 ring-amber-500/10">
            <FileCheck className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">Complete Your KYC</h4>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed font-medium">
              Verify your identity to start investing and trading unlisted stocks seamlessly.
            </p>
          </div>
        </div>
        <button
          onClick={handleCompleteKYC}
          className="mt-4 w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all"
        >
          Start KYC Verification
        </button>
      </div>
    </div>
  );
}
