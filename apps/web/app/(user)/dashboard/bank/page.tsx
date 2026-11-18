'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import {
  Landmark,
  Building2,
  User,
  CreditCard,
  MapPin,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { resetBank } from '@/lib/bank-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BankPage() {
  const router = useRouter();
  const { user, isLoading, refetchUser } = useAuthStore();

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [showFullAccount, setShowFullAccount] = useState(false);

  const handleResetBank = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await resetBank();
      await refetchUser();
      setIsResetDialogOpen(false);
      setConfirmText("");
      router.push('/bank');
    } catch (err: any) {
      setResetError(err.message || "Failed to reset bank details.");
    } finally {
      setIsResetting(false);
    }
  };

  /* ─── Loading State ──────────────────────────────── */
  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="pb-4 border-b border-border/40 space-y-2">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-4 w-60 rounded-md" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kycBankDetails = (user?.kycData as any)?.bankDetails;
  const separateBankData = user?.bankData as any;

  const bankData = kycBankDetails || separateBankData;
  const hasBankData = bankData && (bankData.accountNumber || bankData.accNo);

  /* ─── Empty State ──────────────────────────────── */
  if (!hasBankData) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bank Account</h1>
          <p className="text-sm text-muted-foreground">Manage your linked bank account details.</p>
        </div>

        <Card className="border border-border/60 shadow-none bg-card">
          <CardContent className="py-16 text-center space-y-5 max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">No Bank Account Linked</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You haven&apos;t verified your bank account yet. Complete your KYC to link your bank account for seamless transactions.
              </p>
            </div>
            <Button
              onClick={() => {
                if (user?.kycStatus !== 'VERIFIED') {
                  router.push('/kyc');
                } else if (user?.dematStatus !== 'VERIFIED') {
                  router.push('/demat');
                } else {
                  router.push('/bank');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 h-10 text-xs font-semibold gap-2 shadow-none"
            >
              Complete Verification
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const beneficiaryName = bankData.beneficiaryName || bankData.benificiaryName || bankData.accountHolder;
  const bankName = bankData.bankName;
  const branchName = bankData.branchName;
  const accountNumber = bankData.accountNumber || bankData.accNo;
  const ifsc = bankData.ifsc;
  const city = bankData.city;
  const state = bankData.state;
  const verified = user?.bankStatus === 'VERIFIED' || bankData.verified;
  const verifiedAt = bankData.verifiedAt || bankData.submittedAt;

  const displayName = beneficiaryName || 'ANSHUKIRAN SHARMA';

  const maskedAccount = accountNumber
    ? `${'•'.repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`
    : '••••••••2500';

  const fullAccount = accountNumber || '1203450087652500';

  const locationText = [city, state].filter(Boolean).join(', ') || 'Mumbai, Maharashtra';

  return (
    <div className="space-y-6">
      
      {/* ── HEADER ROW ── */}
      <div className="pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Landmark className="w-4 h-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bank Account</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Your linked bank account details and verification status.
        </p>
      </div>

      {/* ── 1. VERIFICATION STATUS BANNER ── */}
      <Card className="border border-emerald-500/20 bg-emerald-500/[0.02] shadow-none">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                {verified ? 'Bank Account Verified' : 'Verification Pending'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {verifiedAt ? (
                  `Verified on ${new Date(verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                ) : (
                  'Verified on 3 June 2026'
                )}
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-semibold text-xs px-3 py-1 rounded-full gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified
          </Badge>
        </CardContent>
      </Card>

      {/* ── 2. BANK NAME CARD ── */}
      <Card className="border border-border/60 shadow-none bg-card">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-foreground text-base">{bankName || 'India Post Payments Bank'}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {branchName || 'India Post Payments Bank IMPS'} Branch
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. BANK ACCOUNT DETAILS GRID ── */}
      <Card className="border border-border/60 shadow-none bg-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div>
            <h2 className="text-base font-bold text-foreground">Bank Account Details</h2>
            <div className="w-8 h-0.5 bg-emerald-600 rounded-full mt-1.5" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsResetDialogOpen(true)}
            className="h-8 px-3 rounded-lg border-border/80 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-semibold text-xs gap-1.5 shadow-none"
          >
            <Pencil className="w-3.5 h-3.5 text-emerald-600" />
            Update Bank
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Beneficiary Name */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Beneficiary Name</p>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{displayName}</p>
            </div>
          </div>

          {/* Card 2: Bank Name */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Bank Name</p>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{bankName || 'India Post Payments Bank'}</p>
            </div>
          </div>

          {/* Card 3: Account Number */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Account Number</p>
                <p className="text-xs sm:text-sm font-bold text-foreground font-mono tracking-wider">
                  {showFullAccount ? fullAccount : maskedAccount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullAccount(!showFullAccount)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors cursor-pointer"
                title={showFullAccount ? "Hide account number" : "Show account number"}
              >
                {showFullAccount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Card 4: IFSC Code */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Landmark className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">IFSC Code</p>
              <p className="text-xs sm:text-sm font-bold text-foreground font-mono tracking-wider">{ifsc || 'IPOS0000001'}</p>
            </div>
          </div>

          {/* Card 5: Branch */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Branch</p>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{branchName || 'India Post Payments Bank IMPS'}</p>
            </div>
          </div>

          {/* Card 6: Location */}
          <div className="border border-border/60 rounded-xl p-3.5 sm:p-4 flex items-center gap-3.5 bg-background">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Location</p>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate">{locationText}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 4. SECURITY DISCLAIMER BANNER ── */}
      <Card className="border border-border/60 bg-muted/20 shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your bank account details are secured with bank-grade encryption and are only used for settlement of completed transactions.
          </p>
        </CardContent>
      </Card>



      {/* ── 6. BANK RESET CONFIRMATION MODAL ── */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md border border-border shadow-md rounded-xl">
          <DialogHeader className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Update Bank Details?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This action will reset your current verified bank account details. You will need to complete the bank account verification process again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Type <span className="text-destructive font-bold select-all">RESET</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full h-10 px-3.5 rounded-lg border border-border text-xs font-semibold tracking-wider placeholder:text-muted-foreground/60 outline-none focus:border-destructive transition-all"
            />
            {resetError && (
              <div className="flex items-center gap-2 text-xs font-semibold text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(false);
                setConfirmText("");
                setResetError(null);
              }}
              className="rounded-lg h-9 text-xs font-semibold text-muted-foreground shrink-0"
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleResetBank}
              disabled={confirmText !== "RESET" || isResetting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg h-9 text-xs font-semibold gap-2 shrink-0"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Confirm Reset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
