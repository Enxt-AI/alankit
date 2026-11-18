'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { useBankStatus } from '@/hooks/use-bank-status';
import { LoadingState, ErrorState } from '@/components/shared/status-states';
import { LinkBankStep } from '@/components/bank/link-bank-step';
import { OnboardingStepper } from '@/components/kyc/onboarding-stepper';

export default function BankPage() {
  const router = useRouter();
  const { user, refetchUser, isLoading: isAuthLoading } = useAuthStore();
  const { data: bankStatus, isLoading, error, refetch } = useBankStatus();

  const [isRetrying, setIsRetrying] = useState(false);
  const [bankPhase, setBankPhase] = useState<'form' | 'verifying' | 'result'>('form');

  // Redirect if kyc is not done, or demat is not linked, or bank already verified/pending
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Check KYC first
    const isKycDone = user.kycStatus === 'VERIFIED';
    if (!isKycDone) {
      router.push('/kyc');
      return;
    }

    // 2. Check Demat next
    const isDematLinked = user.dematStatus === 'VERIFIED' || (user.dematStatus === 'PENDING' && Boolean((user.dematData as any)?.submittedAt));
    if (!isDematLinked) {
      router.push('/demat');
      return;
    }

    // 3. Already linked check for Bank
    const isBankLinked = user.bankStatus === 'VERIFIED' || (user.bankStatus === 'PENDING' && Boolean((user.bankData as any)?.submittedAt));
    if (isBankLinked) {
      router.push('/profile');
    }
  }, [user, isAuthLoading, router]);

  const handleStepComplete = async () => {
    // Refetch user data to get updated bank status
    await refetchUser();
    await refetch();
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <LoadingState message="Loading bank information..." />
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

  // Dynamic heading & subtitle based on current phase
  const pageHeading =
    bankPhase === 'result'
      ? 'Verification Result'
      : 'Link Your Bank Account';
  const pageSubtitle =
    bankPhase === 'result'
      ? 'Review the details below and continue'
      : 'Verify your bank account to enable secure transactions';

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header — hidden during full-screen verifying overlay */}
      {bankPhase !== 'verifying' && (
        <div className="mb-8 pl-1">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-6 -ml-4 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{pageHeading}</h1>
          <p className="mt-2 text-base text-slate-500 max-w-2xl mb-8">
            {pageSubtitle}
          </p>
          <div className="max-w-3xl mx-auto">
            <OnboardingStepper currentStep={2} />
          </div>
        </div>
      )}

      {/* KYC Warning */}
      {user?.kycStatus !== 'VERIFIED' && user?.kycStatus !== 'PENDING' && (
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <h3 className="font-semibold text-yellow-500">KYC Verification Required</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You need to complete KYC verification before linking your bank account.
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

      {/* Pending State */}
      {user?.bankStatus === 'PENDING' && Boolean((user?.bankData as any)?.submittedAt) && (
        <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Application Under Review</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-6">
            Your bank details are under review. This process may take 1–2 working days. We will notify you once it's approved.
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Return to Dashboard
          </Button>
        </div>
      )}

      {/* Rejected State */}
      {user?.bankStatus === 'REJECTED' && !isRetrying && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">Application Rejected</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-4">
            Your previous bank application was rejected. Please review and resubmit.
          </p>
          {(user?.bankData as any)?.rejectionReason && (
             <div className="mx-auto max-w-md bg-white p-4 rounded-lg border border-red-100 text-left mb-6">
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wider block mb-1">Reason for Rejection</span>
                <p className="text-sm font-medium text-slate-700">{(user?.bankData as any).rejectionReason}</p>
             </div>
          )}
          <Button className="mt-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsRetrying(true)}>
            Review and Resubmit
          </Button>
        </div>
      )}

      {/* Form Container */}
      {((user?.bankStatus === 'PENDING' && !(user?.bankData as any)?.submittedAt) || user?.bankStatus === 'NOT_LINKED' || !user?.bankStatus || isRetrying) && (
        <div className="mt-6">
          <LinkBankStep
            onNext={handleStepComplete}
            initialData={user?.bankData}
            onPhaseChange={setBankPhase}
          />
        </div>
      )}
    </div>
  );
}

