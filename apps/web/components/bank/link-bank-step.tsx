'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { linkBank, BankVerificationError } from '@/lib/bank-api';
import type { BankVerification } from '@/lib/bank-api';
import { useAuthStore } from '@/store/auth-store';

/* ───────────────── Schema ───────────────── */

const linkBankSchema = z
  .object({
    accNo: z.string().min(1, 'Account number is required'),
    confirmAccNo: z.string(),
    ifsc: z
      .string()
      .min(1, 'IFSC code is required')
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC format'),
  })
  .refine((d) => d.accNo === d.confirmAccNo, {
    message: 'Account numbers do not match',
    path: ['confirmAccNo'],
  });

type FormData = z.infer<typeof linkBankSchema>;

/* ───────────────── Types ───────────────── */

type Phase = 'form' | 'verifying' | 'result';

interface VerificationResult {
  success: boolean;
  errorMessage?: string;
  verification?: BankVerification;
}

interface LinkBankStepProps {
  onNext: (data: any) => void;
  initialData?: any;
  onFormChange?: () => void;
  onPhaseChange?: (phase: Phase) => void;
}

/* ───────────────── Verification Steps ───────────────── */

const VERIFICATION_STEPS = [
  'Connecting to bank network',
  'Validating account details',
  'Verifying account holder name',
  'Running fraud & AML checks',
] as const;

const STEP_DURATION = 1600; // ms per animated step

/* ════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════ */

export function LinkBankStep({ onNext, initialData, onFormChange, onPhaseChange }: LinkBankStepProps) {
  const { user } = useAuthStore();

  const [phase, setPhase] = useState<Phase>('form');
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAccNo, setShowAccNo] = useState(false);

  // Notify parent when phase changes
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(linkBankSchema as any),
    defaultValues: {
      accNo: initialData?.accNo || '',
      confirmAccNo: '',
      ifsc: initialData?.ifsc || '',
    },
  });

  // Notify parent of form changes
  const watchedFields = watch();
  useEffect(() => {
    onFormChange?.();
  }, [watchedFields, onFormChange]);

  /* ── Animate verification steps ── */
  useEffect(() => {
    if (phase !== 'verifying') return;

    // Start with step 0 immediately
    setActiveStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i < VERIFICATION_STEPS.length; i++) {
      timers.push(
        setTimeout(() => setActiveStep(i), STEP_DURATION * i),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  /* ── Submit handler ── */
  const onSubmit = useCallback(
    async (data: FormData) => {
      setPhase('verifying');
      setActiveStep(-1);

      // Guarantee the animation runs for at least the full duration
      const minAnimationTime = STEP_DURATION * VERIFICATION_STEPS.length + 600;
      const animationStart = Date.now();

      let outcome: VerificationResult;
      try {
        const response = await linkBank({
          ifsc: data.ifsc.toUpperCase(),
          accNo: data.accNo,
        });

        outcome = {
          success: true,
          verification: response.data?.verification,
        };
      } catch (error: any) {
        const verification =
          error instanceof BankVerificationError ? error.verification : undefined;

        outcome = {
          success: false,
          errorMessage:
            error?.message || 'Bank verification failed. Please try again.',
          verification,
        };
      }

      // Wait for animation to finish
      const elapsed = Date.now() - animationStart;
      const remaining = minAnimationTime - elapsed;
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }

      setResult(outcome);
      setPhase('result');
    },
    [onNext],
  );

  /* ── Copy ref ID ── */
  const copyRefId = useCallback((refId: string) => {
    navigator.clipboard.writeText(refId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  /* ── Retry ── */
  const handleRetry = useCallback(() => {
    setResult(null);
    setActiveStep(-1);
    setPhase('form');
  }, []);

  /* ═══════════════════════════════════════
     PHASE 1 — Form
     ═══════════════════════════════════════ */
  if (phase === 'form') {
    return (
      <div className="w-full max-w-lg mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label htmlFor="accNo" className="text-[13px] font-semibold text-gray-700">
              Account Number
            </Label>
            <div className="relative">
              <Input
                id="accNo"
                type={showAccNo ? 'text' : 'password'}
                placeholder="Enter account number"
                className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:border-emerald-600 pr-11"
                {...register('accNo')}
              />
              <button
                type="button"
                onClick={() => setShowAccNo((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
                aria-label={showAccNo ? 'Hide account number' : 'Show account number'}
              >
                {showAccNo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.accNo && (
              <p className="text-xs text-red-500 font-medium">{errors.accNo.message}</p>
            )}
          </div>

          {/* Re-enter Account Number */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmAccNo" className="text-[13px] font-semibold text-gray-700">
              Re-enter Account Number
            </Label>
            <Input
              id="confirmAccNo"
              placeholder="Re-enter to confirm"
              className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:border-emerald-600"
              onPaste={(e) => e.preventDefault()}
              {...register('confirmAccNo')}
            />
            {errors.confirmAccNo && (
              <p className="text-xs text-red-500 font-medium">{errors.confirmAccNo.message}</p>
            )}
          </div>

          {/* IFSC Code */}
          <div className="space-y-1.5">
            <Label htmlFor="ifsc" className="text-[13px] font-semibold text-gray-700">
              IFSC Code
            </Label>
            <Input
              id="ifsc"
              placeholder="e.g. SBIN0001234"
              className="h-11 rounded-lg border-gray-200 bg-gray-50 text-sm uppercase focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:border-emerald-600"
              {...register('ifsc')}
            />
            {errors.ifsc && (
              <p className="text-xs text-red-500 font-medium">{errors.ifsc.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors mt-2"
          >
            Verify Bank Account
          </Button>
        </form>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     PHASE 2 — Verifying (fullscreen overlay)
     ═══════════════════════════════════════ */
  if (phase === 'verifying') {
    const progress = Math.min(
      ((activeStep + 1) / VERIFICATION_STEPS.length) * 100,
      100,
    );

    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6">
        {/* Spinning shield */}
        <div className="relative w-20 h-20 mb-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-emerald-100 animate-ping opacity-20" />
          <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#d1fae5" strokeWidth="3" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke="#059669" strokeWidth="3"
              strokeDasharray="226"
              strokeDashoffset="170"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">Verifying Account</h2>
        <p className="text-sm text-gray-400 mb-8">This usually takes a few seconds</p>

        {/* Progress bar */}
        <div className="w-full max-w-sm h-1 bg-gray-100 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step list */}
        <div className="w-full max-w-sm space-y-4">
          {VERIFICATION_STEPS.map((label, i) => {
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            const isPending = i > activeStep;

            return (
              <div
                key={label}
                className={`flex items-center gap-3 transition-opacity duration-300 ${
                  isPending ? 'opacity-30' : 'opacity-100'
                }`}
              >
                {/* Icon */}
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {isDone && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {isActive && (
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                  )}
                  {isPending && (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                  )}
                </div>

                <span
                  className={`text-sm ${
                    isDone
                      ? 'text-gray-800 font-medium'
                      : isActive
                      ? 'text-gray-900 font-semibold'
                      : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-300 mt-10">
          Please do not close this page
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════
     PHASE 3 — Verification Result
     ═══════════════════════════════════════ */
  const v = result?.verification;
  const isSuccess = result?.success === true;
  const isNameMatched = v?.nameMatchStatus === 'MATCHED';

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
      {/* Header icon */}
      <div className="flex flex-col items-center mb-8">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isSuccess ? 'bg-emerald-50' : 'bg-red-50'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          ) : (
            <XCircle className="w-8 h-8 text-red-500" />
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {isSuccess ? 'Verification Successful' : 'Verification Failed'}
        </h2>
        {!isSuccess && result?.errorMessage && (
          <p className="text-sm text-red-600 text-center mt-2 max-w-sm leading-relaxed">
            {result.errorMessage}
          </p>
        )}
      </div>

      {/* Data grid */}
      {v && (
        <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
          <Row label="Account Number" value={v.accountNumber} />
          <Row label="Account Type" value={v.accountType} />
          <Row label="Bank Name" value={v.bankName || '—'} />
          <Row label="Branch" value={v.branchName || '—'} />
          <Row label="Name Provided" value={v.nameProvided || '—'} />
          <Row label="Name at Bank" value={v.nameAtBank || '—'} />
          <Row
            label="Name Match"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isNameMatched
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {isNameMatched ? (
                    <>
                      <Check className="w-3 h-3" /> Matched
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Not Matched
                    </>
                  )}
                </span>
                <span className="text-xs text-gray-400">{v.nameMatchScore}%</span>
              </span>
            }
          />
          <Row label="Account Status" value={v.accountStatus} />
          <Row
            label="IFSC Valid"
            value={v.ifscValid ? 'Yes' : 'No'}
          />
          <Row label="AML Check" value={v.amlStatus === 'CLEARED' ? 'Cleared' : 'Flagged'} />
          <Row
            label="Reference ID"
            value={
              <span className="inline-flex items-center gap-2">
                <code className="text-xs font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                  {v.referenceId}
                </code>
                <button
                  type="button"
                  onClick={() => copyRefId(v.referenceId)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </span>
            }
          />
          <Row
            label="Verified At"
            value={new Date(v.verifiedAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
        </div>
      )}

      {/* Actions */}
      {isSuccess ? (
        <Button
          onClick={() => onNext(result?.verification)}
          className="w-full h-11 mt-6 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
        >
          Continue
        </Button>
      ) : (
        <Button
          onClick={handleRetry}
          className="w-full h-11 mt-6 rounded-lg text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white transition-colors"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

/* ───────────────── Row helper ───────────────── */

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800 text-right">
        {value}
      </span>
    </div>
  );
}
