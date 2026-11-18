import React from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Info, ExternalLink } from "lucide-react";
import { generateDigilockerUrl } from "@/lib/kyc-api";
import { useAuthStore } from "@/store/auth-store";

interface DigiLockerVerificationStepProps {
  onNext: (data: any) => void;
  initialData?: any;
}

export function DigiLockerVerificationStep({ onNext }: DigiLockerVerificationStepProps) {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const startDigiLockerFlow = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await generateDigilockerUrl({
        firstName: user?.fullName || "User",
        mobile: user?.phone || "",
        email: user?.email || "",
        origin: window.location.origin,
      });

      if (response?.data?.kycUrl) {
        // Show full-screen redirect overlay before navigating
        setIsRedirecting(true);
        setTimeout(() => {
          window.location.href = response.data.kycUrl;
        }, 300);
        // Don't reset isLoading — page is navigating away
      } else {
        setErrorMessage('Could not start DigiLocker. Please try again.');
        setIsLoading(false);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not start DigiLocker. Please try again.');
      setIsLoading(false);
    }
  };

  // Full-screen "Redirecting to DigiLocker" overlay
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xs">
          {/* Spinning ring */}
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40 scale-110" />
            <svg
              className="absolute inset-0 -rotate-90 animate-spin"
              style={{ animationDuration: "1.2s" }}
              viewBox="0 0 80 80"
              width="80"
              height="80"
            >
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="#0C1A97"
                strokeWidth="4"
                strokeDasharray="226"
                strokeDashoffset="170"
                strokeLinecap="round"
              />
            </svg>
            <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-br from-[#0C1A97] to-[#3B5BDB] flex items-center justify-center shadow-xl shadow-blue-900/30">
              <ExternalLink className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">
            Opening DigiLocker
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            You are being redirected to the Government DigiLocker portal. Please complete verification there and return here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header & Govt Badge */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Identity Verification
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Verify PAN & Aadhaar via DigiLocker
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100/80 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Govt. Authorized
          </span>
        </div>
      </div>

      {/* Main Action Card */}
      <div className="p-4 sm:p-6 border border-slate-100 rounded-2xl sm:rounded-3xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0 ring-4 ring-indigo-500/10">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Fast &amp; Secure Verification
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
              You will be redirected to the official DigiLocker portal. Your verified PAN and Aadhaar records will be fetched automatically—no manual document uploads needed.
            </p>
          </div>
        </div>

        {errorMessage && <p role="alert" className="mt-4 text-sm text-red-600">{errorMessage}</p>}
        <Button
          onClick={startDigiLockerFlow}
          disabled={isLoading}
          className="w-full mt-4 h-11 sm:h-12 bg-gradient-to-r from-[#0C1A97] via-[#1E299B] to-[#3B5BDB] hover:opacity-95 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting to DigiLocker...
            </>
          ) : (
            <>
              Proceed with DigiLocker <ExternalLink className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Compact Info Banner */}
      <div className="mt-3.5 p-3 sm:p-4 bg-slate-50/80 border border-slate-100 rounded-xl sm:rounded-2xl flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed font-medium">
          <span className="font-bold text-slate-900">Why DigiLocker? </span>
          SEBI regulations require identity verification. DigiLocker securely fetches official records to prevent fraud while preserving your privacy.
        </div>
      </div>
    </div>
  );
}
