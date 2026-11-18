import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Edit,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react";
import { submitKYC } from "@/lib/kyc-api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface ReviewSubmitStepProps {
  onSuccess: () => void;
  onEdit: (step: number) => void;
  kycData: any;
  onRestartDigilocker?: () => void;
}

export function ReviewSubmitStep({
  onSuccess,
  onEdit,
  kycData,
  onRestartDigilocker,
}: ReviewSubmitStepProps) {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  const panData = kycData.panDetails?.pan || kycData.pan || user?.kycData?.panDetails?.pan;
  const fullName = kycData.fullName || user?.kycData?.fullName || user?.kycData?.panDetails?.name;
  const dob = kycData.dob || user?.kycData?.dob || user?.kycData?.panDetails?.dob;
  
  // Self-heal: If the old stub "FETCHED_AADHAAR" is present but we have the real raw digitapDetails stored, use digitapDetails natively!
  const rawDigitap = kycData.digitapDetails || user?.kycData?.digitapDetails;

  const aadhaarData = (kycData.aadhaarDetails?.aadhaar !== "FETCHED_AADHAAR" && kycData.aadhaarDetails?.aadhaar) 
    ? kycData.aadhaarDetails?.aadhaar 
    : rawDigitap?.maskedAdharNumber || user?.kycData?.aadhaarDetails?.aadhaar;
    
  const photoData = kycData.aadhaarDetails?.photo || rawDigitap?.image || user?.kycData?.aadhaarDetails?.photo;

  const careOf =
    kycData.fatherName ||
    (kycData as any)?.careOf ||
    user?.kycData?.fatherName ||
    (user?.kycData as any)?.careOf ||
    user?.kycData?.aadhaarDetails?.fatherName ||
    (user?.kycData?.aadhaarDetails as any)?.careOf ||
    (rawDigitap as any)?.careOf;
  const address = kycData.address || user?.kycData?.address || user?.kycData?.aadhaarDetails?.address;
  const gender = kycData.aadhaarDetails?.gender || user?.kycData?.aadhaarDetails?.gender;

  const isDataComplete = Boolean(
    panData && fullName
  );

  const maskPAN = (pan: string) => {
    // Hide the FETCHED_PAN mock if it happens to reach here
    if (!pan || pan === "FETCHED_PAN") return "—";
    return pan;
  };

  const handleSubmit = async () => {
    if (!isDataComplete) {
      console.warn("Required identity information missing from Digilocker.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await submitKYC();
      // toast removed
      onSuccess();
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Final Review &amp; Submission
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Step 2: Confirm your DigiLocker verified details
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100/80 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Ready
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {!isDataComplete && (
            <RetryWithCountdown onRestartDigilocker={onRestartDigilocker} />
          )}

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {photoData && (
                  <img 
                    src={`data:image/jpeg;base64,${photoData}`} 
                    className="w-14 h-14 rounded-full object-cover border-[3px] border-white shadow-sm ring-1 ring-gray-900/5" 
                    alt="Verified Profile" 
                  />
                )}
                <div>
                  <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
                    Identity Details
                  </h3>
                  <span className="mt-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED BY DIGILOCKER
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  PAN Number
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {panData ? maskPAN(panData) : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Aadhaar Number
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {aadhaarData ? `********${String(aadhaarData).slice(-4)}` : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Full Name
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {fullName || "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Date of Birth
                </p>
                <p className="text-sm font-bold text-gray-900">{dob || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Gender
                </p>
                <p className="text-sm font-bold text-gray-900">{gender || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Care Of
                </p>
                <p className="text-sm font-bold text-gray-900">{careOf || "—"}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Address
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {typeof address === 'object' ? Object.values(address).filter(Boolean).join(', ') : (address || "—")}
                </p>
              </div>
            </div>
          </div>


        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-emerald-900 text-white rounded-3xl shadow-xl shadow-emerald-900/10">
            <h4 className="text-lg font-bold mb-4">Secure Submission</h4>
            <p className="text-xs text-emerald-100/80 leading-relaxed mb-6">
              Your identity details have been successfully and securely fetched 
              from DigiLocker. Click below to submit your verified application.
            </p>

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !isDataComplete}
              className={cn(
                "w-full h-12 font-bold rounded-2xl shadow-xl transition-all",
                isLoading
                  ? "bg-emerald-800/30 text-emerald-400 cursor-not-allowed opacity-60 shadow-none pointer-events-none"
                  : isDataComplete
                  ? "bg-white text-emerald-900 hover:bg-emerald-50 shadow-black/20 active:scale-[0.98]"
                  : "bg-emerald-800/50 text-emerald-500 cursor-not-allowed border border-emerald-700/50",
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  SUBMITTING...
                </>
              ) : (
                "SUBMIT APPLICATION"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Self-contained 30-second countdown that fires onRestartDigilocker when done */
function RetryWithCountdown({
  onRestartDigilocker,
}: {
  onRestartDigilocker?: () => void;
}) {
  const TOTAL_SECONDS = 30;
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(TOTAL_SECONDS);
  };

  const cancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
  };

  React.useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      onRestartDigilocker?.();
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown, onRestartDigilocker]);

  const isCountingDown = countdown !== null && countdown > 0;
  const progress = isCountingDown
    ? ((TOTAL_SECONDS - countdown) / TOTAL_SECONDS) * 100
    : 0;

  return (
    <div className="p-4 sm:p-5 bg-red-50 border border-red-100 rounded-2xl space-y-4">
      <div className="flex gap-3">
        <div>
          <p className="text-sm font-semibold text-red-800">
            Some details could not be fetched from DigiLocker
          </p>
          <p className="text-xs text-red-600 mt-1 leading-relaxed">
            DigiLocker session expired. Please retry to complete KYC.
          </p>
        </div>
      </div>

      {onRestartDigilocker && (
        <>
          {!isCountingDown ? (
            <Button
              onClick={startCountdown}
              className="w-full h-11 bg-[#0C1A97] hover:bg-[#091373] text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center"
            >
              Retry
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0C1A97] rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">
                  Redirecting to DigiLocker in{" "}
                  <span className="text-[#0C1A97] font-black tabular-nums">
                    {countdown}s
                  </span>
                </p>
                <button
                  onClick={cancelCountdown}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
