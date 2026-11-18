'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2, Landmark, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/store/auth-store';
import { useDematStatus } from '@/hooks/use-demat-status';
import { LoadingState, ErrorState, SuccessState } from '@/components/shared/status-states';
import { LinkExistingStep } from '@/components/demat/link-existing-step';
import { OnboardingStepper } from '@/components/kyc/onboarding-stepper';

const SMC_EKYC_SIGNUP_URL = 'https://uat-signup.smctradeonline.com/unlistedstox/e-kyc/mobile';

export default function DematPage() {
  const router = useRouter();
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const { user, refetchUser, isLoading: isAuthLoading } = useAuthStore();
  const { data: dematStatus, isLoading, error, refetch } = useDematStatus();

  const [dematData, setDematData] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasDematChoice, setHasDematChoice] = useState<'undecided' | 'yes' | 'no'>('undecided');

  // Redirect if kyc is not done, or demat already linked/pending or verified
  useEffect(() => {
    if (isAuthLoading) return;
    const updateRequested = new URLSearchParams(window.location.search).get('update') === '1';
    setIsUpdateMode(updateRequested);
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Check if KYC is completed (VERIFIED)
    const isKycDone = user.kycStatus === 'VERIFIED';
    if (!isKycDone) {
      router.push('/kyc');
      return;
    }

    // 2. Already linked check
    const isDematLinked = !updateRequested && (user.dematStatus === 'VERIFIED' || (user.dematStatus === 'PENDING' && Boolean((user.dematData as any)?.submittedAt)));
    const isBankLinked = user.bankStatus === 'VERIFIED' || (user.bankStatus === 'PENDING' && Boolean((user.bankData as any)?.submittedAt));

    if (isDematLinked) {
      if (!isBankLinked) {
        router.push('/bank');
      } else {
        router.push('/profile');
      }
    }
  }, [user, isAuthLoading, router]);

  // Resume from saved progress
  useEffect(() => {
    if (user?.dematData) {
      const savedType = user.dematData.type;
      if (savedType === 'link') {
        setDematData(user.dematData);
      }
    }
  }, [user]);

  // Success countdown timer
  useEffect(() => {
    if (showSuccess && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showSuccess && countdown === 0) {
      handleRedirectToDashboard();
    }
  }, [showSuccess, countdown]);



  const handleStepComplete = async (data: any) => {
    // Include the type of data saved
    const dataWithType = {
      ...data,
      type: 'link',
    };
    setDematData(dataWithType);
    setHasUnsavedProgress(false);
    setShowSuccess(true);
    
    // Refetch user data to get updated demat status
    await refetchUser();
    await refetch();
  };

  const handleRedirectToDashboard = () => {
    const isBankLinked = user?.bankStatus === 'VERIFIED' || user?.bankStatus === 'PENDING';
    if (!isBankLinked) {
      router.push('/bank');
    } else {
      router.push('/profile');
    }
  };

  const handleBackClick = () => {
    // If user is on the form, go back to the choice screen instead of leaving the page
    if (hasDematChoice === 'yes') {
      setHasDematChoice('undecided');
      setHasUnsavedProgress(false);
      return;
    }
    if (hasUnsavedProgress) {
      setShowExitDialog(true);
    } else {
      router.push('/');
    }
  };

  const handleExitConfirm = () => {
    setShowExitDialog(false);
    router.push('/');
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <LoadingState message="Loading demat information..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <SuccessState 
          title="Application Submitted Successfully!"
          message="Your application is under review. This process may take 1–2 working days. Redirecting to dashboard in {countdown} seconds..."
          countdown={countdown} 
        />
      </div>
    );
  }

  // Determine whether to show the choice screen
  const showFormDirectly =
    isUpdateMode ||
    (user?.dematStatus === 'PENDING' && Boolean((user?.dematData as any)?.submittedAt)) ||
    (user?.dematStatus === 'REJECTED') ||
    isRetrying;
  const showChoiceScreen =
    !showFormDirectly &&
    hasDematChoice === 'undecided' &&
    ((user?.dematStatus === 'PENDING' && !(user?.dematData as any)?.submittedAt) || user?.dematStatus === 'NOT_LINKED');

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-5 sm:mb-8 pl-1">
        <Button
          variant="ghost"
          onClick={handleBackClick}
          className="mb-3 sm:mb-6 -ml-4 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900">Link Your Demat Account</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-500 max-w-2xl mb-4 sm:mb-8">
          Link your demat account to receive allocated stocks in your portfolio
        </p>
        <div className="max-w-3xl mx-auto">
          <OnboardingStepper currentStep={1} />
        </div>
      </div>

      {/* KYC Warning */}
      {user?.kycStatus !== 'VERIFIED' && user?.kycStatus !== 'PENDING' && (
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-yellow-500">KYC Verification Required</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You need to complete KYC verification before linking your demat account.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push('/kyc')}
              >
                Complete KYC
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Demat Choice Screen */}
      {showChoiceScreen && (
        <div className="mt-4 sm:mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Option 1: I have a Demat Account */}
            <button
              type="button"
              onClick={() => setHasDematChoice('yes')}
              className="group relative rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-white p-5 sm:p-8 text-left shadow-sm transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <div className="mb-3 sm:mb-5 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-lg sm:rounded-xl bg-blue-50 transition-colors group-hover:bg-blue-100">
                <Landmark className="h-5 w-5 sm:h-7 sm:w-7 text-blue-600" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-slate-900 mb-1 sm:mb-2">I Have a Demat Account</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Link your existing demat account by entering your DP ID and Client ID. Your stocks will be credited directly to this account.
              </p>
              <div className="mt-4 sm:mt-6 inline-flex items-center text-xs sm:text-sm font-medium text-blue-600 group-hover:text-blue-700">
                Link Now
                <ArrowLeft className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-180 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            {/* Option 2: I don't have a Demat Account */}
            <button
              type="button"
              onClick={() => {
                window.open(SMC_EKYC_SIGNUP_URL, '_blank', 'noopener,noreferrer');
              }}
              className="group relative rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-white p-5 sm:p-8 text-left shadow-sm transition-all duration-200 hover:border-emerald-500 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <div className="mb-3 sm:mb-5 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-50 transition-colors group-hover:bg-emerald-100">
                <ExternalLink className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-600" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-slate-900 mb-1 sm:mb-2">I Don&apos;t Have a Demat Account</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                No worries! Open a free demat account with SMC Global Securities in just a few minutes through our quick e-KYC process.
              </p>
              <div className="mt-4 sm:mt-6 inline-flex items-center text-xs sm:text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
                Create Account
                <ExternalLink className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Pending State */}
      {!isUpdateMode && user?.dematStatus === 'PENDING' && Boolean((user?.dematData as any)?.submittedAt) && (
        <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-yellow-200 bg-yellow-50 p-5 sm:p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-yellow-100">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-yellow-600" />
          </div>
          <h2 className="mb-1.5 sm:mb-2 text-lg sm:text-2xl font-bold text-slate-800">Application Under Review</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-4 sm:mb-6">
            Your application is under review. This process may take 1–2 working days. We will notify you once it's approved.
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Return to Dashboard
          </Button>
        </div>
      )}

      {/* Rejected State */}
      {user?.dematStatus === 'REJECTED' && !isRetrying && (
        <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
          </div>
          <h2 className="mb-1.5 sm:mb-2 text-lg sm:text-2xl font-bold text-slate-800">Application Rejected</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-3 sm:mb-4">
            Your previous application was rejected. Please review and resubmit.
          </p>
          {(user?.dematData as any)?.rejectionReason && (
            <div className="mx-auto max-w-md bg-white p-3 sm:p-4 rounded-lg border border-red-100 text-left mb-4 sm:mb-6">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider block mb-1">Reason for Rejection</span>
              <p className="text-xs sm:text-sm font-medium text-slate-700">{(user?.dematData as any).rejectionReason}</p>
            </div>
          )}
          <Button className="mt-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsRetrying(true)}>
            Review and Resubmit
          </Button>
        </div>
      )}

      {/* Form Container — shown when user chose "yes" or is retrying */}
      {(isUpdateMode || (hasDematChoice === 'yes' && ((user?.dematStatus === 'PENDING' && !(user?.dematData as any)?.submittedAt) || user?.dematStatus === 'NOT_LINKED')) || isRetrying) && (
        <div className="mt-6">
          <LinkExistingStep
            onNext={handleStepComplete}
            isUpdateMode={isUpdateMode}
            initialData={dematData?.type === 'link' ? dematData : null}
            onFormChange={() => setHasUnsavedProgress(true)}
          />
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Progress</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress has been saved and you can continue later. Are you sure you want to
              exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExitConfirm}>Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
