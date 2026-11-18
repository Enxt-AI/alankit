"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Briefcase,
  Building2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Stepper, StepItem } from "@/components/kyc/stepper";
import { OnboardingStepper } from "@/components/kyc/onboarding-stepper";
import { DigiLockerVerificationStep } from "@/components/kyc/steps/digilocker-verification-step";
import { ReviewSubmitStep } from "@/components/kyc/steps/review-submit-step";
import { KycLoading } from "@/components/kyc/kyc-loading";
import { KycError } from "@/components/kyc/kyc-error";
import { DigiLockerProcessingLoader } from "@/components/kyc/digilocker-processing-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const steps: StepItem[] = [
  { label: "DigiLocker Verification", description: "Verify PAN and Aadhaar" },
  { label: "Review & Submit", description: "Final submission" },
];


/**
 * Default page export wraps KycPageContent in a Suspense boundary.
 * This is required because useSearchParams() (used for ?status= detection
 * on return from EnxtAI) triggers a client-side bailout during static generation.
 */
export default function KycPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <KycLoading />
          </div>
        </div>
      }
    >
      <KycPageContent />
    </Suspense>
  );
}

function KycPageContent() {
  const router = useRouter();
  const { user, refetchUser, wasDeactivated, setWasDeactivated, isLoading: isAuthLoading } = useAuthStore();
  const {
    data: kycStatus,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useKycStatus();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [kycData, setKycData] = React.useState<any>({});

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);
  const [showExitDialog, setShowExitDialog] = React.useState(false);
  const [showReactivationDialog, setShowReactivationDialog] = React.useState(false);
  const [hasUnsavedProgress, setHasUnsavedProgress] = React.useState(false);

  React.useEffect(() => {
    if (wasDeactivated) {
      setShowReactivationDialog(true);
      setWasDeactivated(false);
    }
  }, [wasDeactivated, setWasDeactivated]);


  const [isFetchingCallback, setIsFetchingCallback] = React.useState(false);
  const callbackInFlight = React.useRef(false);
  const [callbackError, setCallbackError] = React.useState<string | null>(null);

  const searchParams = useSearchParams();
  const redoKyc = searchParams.get("redo") === "true";

  React.useEffect(() => {
    if (user?.kycStatus === "VERIFIED" && !redoKyc) {
      const isDematLinked = user?.dematStatus === "VERIFIED" || (user?.dematStatus === "PENDING" && Boolean((user?.dematData as any)?.submittedAt));
      const isBankLinked = user?.bankStatus === "VERIFIED" || (user?.bankStatus === "PENDING" && Boolean((user?.bankData as any)?.submittedAt));

      if (!isDematLinked) {
        router.push("/demat");
      } else if (!isBankLinked) {
        router.push("/bank");
      } else {
        router.push("/profile");
      }
    }
  }, [user, router, redoKyc]);

  React.useEffect(() => {
    if (kycStatus) {
      const savedStep = kycStatus.currentKycStep || 0;
      if (savedStep > 0 && savedStep <= 2) {
        setCurrentStep(Math.min(savedStep, 2));
      }

      if (user?.kycData) {
        const existingData: any = { ...user.kycData };
        if (user.kycData.panDetails) {
          existingData.pan = user.kycData.panDetails.pan;
          existingData.fullName = user.kycData.panDetails.name;
          existingData.dob = user.kycData.panDetails.dob;
        }
        setKycData(existingData);
      }
    }
  }, [kycStatus, user?.kycData]);

  // Handle DigiLocker Callback
  React.useEffect(() => {
    const isCallback = searchParams.get("digilocker_callback");
    if (isCallback === "true") {
      setStarted(true);
      if (currentStep === 0 && !callbackInFlight.current && !callbackError) {
        callbackInFlight.current = true;
        const fetchDetails = async () => {
           try {
             setIsFetchingCallback(true);
             const { fetchDigilockerDetails } = await import("@/lib/kyc-api");
             await fetchDigilockerDetails();
             await refetch();
             await refetchUser();
             setCurrentStep(1);
           } catch (e) {
             setCallbackError(e instanceof Error ? e.message : 'Verification failed. Please try again.');
           } finally {
             callbackInFlight.current = false;
             setIsFetchingCallback(false);
           }
        };
        fetchDetails();
      }
    }
  }, [searchParams, currentStep, callbackError, refetch, refetchUser]);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedProgress) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedProgress]);


  const handleStepComplete = (stepData: any) => {
    setKycData((prev: any) => ({ ...prev, ...stepData }));
    setHasUnsavedProgress(true);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRestartDigilocker = () => {
    // Clear all stale DigiLocker data so a fresh session is generated
    setKycData({});
    setCurrentStep(0);
  };

  const handleEdit = (step: number) => {
    setCurrentStep(step);
  };

  const handleSuccess = async () => {
    setHasUnsavedProgress(false);
    await refetchUser();
  };

  const handleExit = () => {
    if (hasUnsavedProgress) {
      setShowExitDialog(true);
    } else {
      router.push("/");
    }
  };

  const confirmExit = () => {
    setShowExitDialog(false);
    router.push("/");
  };

  // Show dedicated DigiLocker processing loader while fetching callback data
  if (isFetchingCallback) {
    return <DigiLockerProcessingLoader />;
  }
  if (callbackError && currentStep === 0) {
    return <KycError error={new Error(callbackError)} onRetry={() => setCallbackError(null)} />;
  }


  // Show generic KYC skeleton only on first load (not refetch)
  if (isLoading && !isFetching) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="container mx-auto px-4 py-8">
          <KycLoading />
        </div>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="container mx-auto px-4 py-8">
          <KycError error={error as Error} onRetry={refetch} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-emerald-50/50 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-blue-50/50 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-8 sm:mb-12">
          <Button
            variant="ghost"
            onClick={handleExit}
            className="group flex items-center gap-2 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 font-bold transition-all px-4"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Button>
        </div>

        <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
            Verify Your Identity
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Secure, fast, and required by SEBI to start trading unlisted stocks
            in India.
          </p>
          <div className="max-w-3xl mx-auto">
            <OnboardingStepper currentStep={0} />
          </div>
        </div>

          <div className="space-y-12 sm:space-y-20">
            {/* Stepper Container */}
            {started && (
              <div className="max-w-3xl mx-auto">
                <Stepper currentStep={currentStep} steps={steps} />
              </div>
            )}

            {/* Step Content Card */}
            <div className="max-w-4xl mx-auto relative">
              <div className="absolute inset-0 bg-emerald-50 rounded-[40px] rotate-1 scale-[1.02] opacity-50 blur-sm -z-10" />
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-200/50 p-6 sm:p-10 lg:p-16 transition-all">
                {!started ? (
                  <div className="space-y-8 max-w-2xl mx-auto">
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100/80 mb-3">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Single-Session Verification
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Verification Checklist
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl mx-auto leading-relaxed">
                        Please ensure you have the following documents and details ready before starting:
                      </p>
                    </div>

                    <div className="grid gap-3.5 sm:gap-4 mt-6">
                      {/* Item 1 */}
                      <div className="flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 bg-slate-50/40 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all duration-300 shadow-sm">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 flex items-center justify-center font-bold text-xs shrink-0 ring-4 ring-emerald-500/10">
                          <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">KYC Verification: Aadhaar Card</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                            Requires your <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">Aadhaar Number</span> (linked to your active mobile number to receive DigiLocker OTP).
                          </p>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 bg-slate-50/40 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-300 shadow-sm">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0 ring-4 ring-blue-500/10">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Demat Verification: CML / CMR / DP Statement</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                            Requires any one of these documents to link Demat Account: <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">CML</span> (Recommended), <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">CMR</span> or <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">DP Statement</span>.
                          </p>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 bg-slate-50/40 hover:border-amber-200 hover:bg-amber-50/20 transition-all duration-300 shadow-sm">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 flex items-center justify-center font-bold text-xs shrink-0 ring-4 ring-amber-500/10">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Bank Verification: Payout Bank Details</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                            Requires your basic bank details including <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">Account Number</span> & <span className="font-bold text-slate-900 bg-slate-200/60 px-1.5 py-0.5 rounded text-[11px]">IFSC Code</span> to set up payouts.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-center">
                      <Button
                        onClick={() => setStarted(true)}
                        className="w-full sm:w-72 h-12 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        Start Verification <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentStep === 0 && (
                      <DigiLockerVerificationStep
                        onNext={handleStepComplete}
                        initialData={kycData}
                      />
                    )}

                    {currentStep === 1 && (
                      <ReviewSubmitStep
                        onSuccess={handleSuccess}
                        onEdit={handleEdit}
                        kycData={kycData}
                        onRestartDigilocker={handleRestartDigilocker}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Nav controls if not first/last step (special handling in steps) */}
              {currentStep === 1 && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="text-gray-400 hover:text-gray-600 font-bold flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Step 1
                  </Button>
                </div>
              )}
            </div>
          </div>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-8 sm:p-10 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Wait! You&apos;re almost there.
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 text-base mt-4 leading-relaxed">
              Your progress is saved, but you won&apos;t be able to buy or sell
              until your KYC is verified. Are you sure you want to stop now?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-10 flex flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="w-full h-12 rounded-xl border-gray-100 hover:bg-gray-50 font-bold transition-all">
              Complete KYC
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              className="w-full h-12 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border-none font-bold transition-all"
            >
              Exit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReactivationDialog} onOpenChange={setShowReactivationDialog}>
        <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-8 sm:p-10 max-w-md bg-white">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold tracking-tight text-gray-900 text-center">
              Reactivation Required
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 text-sm leading-relaxed text-center">
              This account was previously deactivated. To reactivate fully and resume unlisted stock trading, you must redo your KYC, Demat, and Bank verification steps. Your previous verification details have been reset for security.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-8 flex justify-center">
            <AlertDialogAction
              onClick={() => setShowReactivationDialog(false)}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all border-none"
            >
              Get Started
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
