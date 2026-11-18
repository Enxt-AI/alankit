"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Shield,
} from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import { deactivateUserAccount, deleteUserAccount } from "@/lib/auth-api";
import { resetKyc } from "@/lib/kyc-api";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ActiveSessionsDialog from '@/components/shared/active-sessions-dialog';

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading, logout, refetchUser } = useAuthStore();
  const router = useRouter();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const [isKycResetDialogOpen, setIsKycResetDialogOpen] = useState(false);
  const [isKycResetting, setIsKycResetting] = useState(false);
  const [kycResetError, setKycResetError] = useState<string | null>(null);
  const [isDematUpdateDialogOpen, setIsDematUpdateDialogOpen] = useState(false);

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const { data: kycStatusData, refetch: refetchKycStatus } = useKycStatus();

  // Auth Guard: redirect to login if unauthenticated
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/settings");
    }
  }, [isAuthenticated, isLoading, router]);

  /* ─── Loading Skeletons ───────────────────────────── */
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <Skeleton className="h-10 w-full" />
          <div className="p-5 space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <Skeleton className="h-10 w-full" />
          <div className="p-5 space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const handleDeactivate = async () => {
    if (confirmText.toUpperCase() !== "DEACTIVATE") {
      setErrorMessage("Please type DEACTIVATE to confirm.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await deactivateUserAccount();
      if (response.success) {
        logout();
        setIsDeactivateDialogOpen(false);
        window.location.href = "/login?clear=true&deactivated=true";
      } else {
        setErrorMessage(response.message || "Failed to deactivate account.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText.toUpperCase() !== "DELETE") {
      setDeleteErrorMessage("Please type DELETE to confirm.");
      return;
    }

    setIsDeleteSubmitting(true);
    setDeleteErrorMessage(null);

    try {
      const response = await deleteUserAccount();
      if (response.success) {
        logout();
        setIsDeleteDialogOpen(false);
        window.location.href = "/login?clear=true&deleted=true";
      } else {
        setDeleteErrorMessage(response.message || "Failed to delete account.");
      }
    } catch (err: any) {
      setDeleteErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const handleUpdateKyc = async () => {
    setIsKycResetting(true);
    setKycResetError(null);
    try {
      await resetKyc();
      await refetchUser();
      await refetchKycStatus();
      setIsKycResetDialogOpen(false);
      router.push("/kyc?redo=true");
    } catch (err: any) {
      setKycResetError(err.message || "Failed to start your KYC update.");
    } finally {
      setIsKycResetting(false);
    }
  };

  return (
    <div className="pb-6 md:pb-8 animate-in fade-in duration-300">
      <div className="space-y-6">
        {/* ─── Header ─── */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage your account access, security, and profile preferences.
          </p>
        </div>

        {/* ─── Account Verification ─── */}
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Account Verification
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            <button
              onClick={() => { setKycResetError(null); setIsKycResetDialogOpen(true); }}
              disabled={user?.kycStatus === 'PENDING'}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
            >
              <div className="flex items-center gap-3.5">
                <ShieldCheck className="h-[18px] w-[18px] text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" strokeWidth={1.5} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-slate-800">Update KYC</p>
                    {kycStatusData?.hasBeenVerified && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        kycStatusData.kycUpdatesRemaining === 0
                          ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}>
                        {kycStatusData.kycUpdatesRemaining ?? 2} of 2 updates left this year
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Update PAN, Aadhaar, or personal details</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
            </button>

            <button
              onClick={() => setIsDematUpdateDialogOpen(true)}
              disabled={user?.dematStatus === 'PENDING'}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
            >
              <div className="flex items-center gap-3.5">
                <Wallet className="h-[18px] w-[18px] text-slate-400 group-hover:text-violet-600 transition-colors shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Update Demat</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Update BO ID, DP ID, or documents</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* ─── Danger Zone ─── */}
        <div className="bg-white rounded-xl border border-red-100/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-red-100/60 bg-red-50/30">
            <h2 className="text-[11px] font-semibold text-red-400 uppercase tracking-widest">
              Danger Zone
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            <button
              onClick={() => { setConfirmText(""); setErrorMessage(null); setIsDeactivateDialogOpen(true); }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50/40 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5">
                <Trash2 className="h-[18px] w-[18px] text-slate-400 group-hover:text-red-500 transition-colors shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium text-red-600">Deactivate Account</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Temporarily disable your profile</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-300 transition-colors shrink-0" />
            </button>

            <button
              onClick={() => { setDeleteConfirmText(""); setDeleteErrorMessage(null); setIsDeleteDialogOpen(true); }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50/40 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5">
                <ShieldAlert className="h-[18px] w-[18px] text-slate-400 group-hover:text-red-500 transition-colors shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium text-red-600">Delete Account</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Permanently close your profile</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-300 transition-colors shrink-0" />
            </button>
          </div>
        </div>

        {/* ─── Security ─── */}
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Security
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            <button
              onClick={() => setSessionsOpen(true)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors text-left group"
            >
              <div className="flex items-center gap-3.5">
                <Shield className="h-[18px] w-[18px] text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Active Sessions & Devices</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Manage and log out of other devices</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Deactivate Confirmation Modal ─── */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-sm w-[90vw] border border-slate-200 shadow-xl rounded-2xl p-0 bg-white overflow-hidden max-h-[90vh]">
          <div className="p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Deactivate Account</h2>
            <p className="text-xs text-slate-500 mb-3">Temporarily disable your profile and access to services.</p>
            
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 space-y-2 mb-4">
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Your active unlisted stock portfolio and holdings will remain safely stored.</li>
                <li>Your access, watchlist, and notifications will be immediately disabled.</li>
                <li>You will be immediately logged out of all active devices.</li>
                <li>To reactivate in the future, simply log back in (you may need to redo KYC).</li>
              </ul>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-2">
              Type <span className="font-mono font-bold text-rose-600">DEACTIVATE</span> to confirm:
            </p>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none transition-all duration-200"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isSubmitting}
            />

            {errorMessage && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeactivateDialogOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl font-medium text-slate-700 border-slate-200 bg-white hover:bg-slate-100 transition-colors duration-200 h-10 px-5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isSubmitting || confirmText.toUpperCase() !== "DEACTIVATE"}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium transition-all duration-200 h-10 px-5"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Modal ─── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm w-[90vw] border border-rose-200 shadow-xl rounded-2xl p-0 bg-white overflow-hidden max-h-[90vh]">
          <div className="p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Delete Account</h2>
            <p className="text-xs text-slate-500 mb-3">Permanently delete your profile and all associated data.</p>
            
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 space-y-2 mb-4">
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-700/90 font-medium">
                <li>Your account will be permanently deleted and cannot be recovered.</li>
                <li>Any unlisted stock portfolio data or holdings linked to this account will be lost.</li>
                <li>Your KYC details, Demat information, and transaction history will be purged.</li>
                <li>Active orders or pending verifications will be immediately cancelled.</li>
              </ul>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-2">
              Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all duration-200"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={isDeleteSubmitting}
            />

            {deleteErrorMessage && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{deleteErrorMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleteSubmitting}
              className="rounded-xl font-medium text-slate-700 border-slate-200 bg-white hover:bg-slate-100 transition-colors duration-200 h-10 px-5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleteSubmitting || deleteConfirmText.toUpperCase() !== "DELETE"}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-all duration-200 h-10 px-5"
            >
              {isDeleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Update KYC Confirmation ─── */}
      <Dialog open={isKycResetDialogOpen} onOpenChange={setIsKycResetDialogOpen}>
        <DialogContent className="sm:max-w-md w-[90vw] border border-slate-200 shadow-2xl rounded-2xl p-0 bg-white overflow-hidden max-h-[90vh]">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Update your KYC details?</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Review what you’ll need to do before continuing.
                </DialogDescription>
              </div>
            </div>

            {kycStatusData?.hasBeenVerified && kycStatusData.canUpdateKyc === false ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-900">Update limit reached</p>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      You can update KYC up to 2 times per year after your initial verification.
                      {kycStatusData.nextKycUpdateAvailableAt && (
                        <span className="block mt-1 font-semibold text-rose-800">
                          You can update again on {new Date(kycStatusData.nextKycUpdateAvailableAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
                        </span>
                      )}
                      <span className="block mt-1">Contact support if you need help.</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <ul className="space-y-2.5 text-xs leading-relaxed text-slate-700">
                  <li className="flex gap-2"><span className="text-blue-500">•</span><span>Continuing will clear your current KYC submission so you can provide updated details.</span></li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span><span>You’ll need to submit your PAN, Aadhaar, and personal details again.</span></li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span><span>New orders will be unavailable until your updated KYC is verified.</span></li>
                  {kycStatusData?.hasBeenVerified && (
                    <li className="flex gap-2 text-amber-800">
                      <span>•</span><span><strong>Updates remaining:</strong> {Math.max(0, (kycStatusData.kycUpdatesRemaining ?? 2) - 1)} this year after this update.</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {kycResetError && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{kycResetError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsKycResetDialogOpen(false)}
              disabled={isKycResetting}
              className="rounded-xl font-medium text-slate-700 border-slate-200 bg-white hover:bg-slate-100 transition-colors duration-200 h-10 px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateKyc}
              disabled={isKycResetting || (kycStatusData?.hasBeenVerified && kycStatusData.canUpdateKyc === false)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-all duration-200 h-10 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isKycResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue to KYC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDematUpdateDialogOpen} onOpenChange={setIsDematUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md w-[90vw] border border-slate-200 shadow-2xl rounded-2xl p-0 bg-white overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Wallet className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">Update Demat details?</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Review what changes when you submit a replacement.
                </DialogDescription>
              </div>
            </div>

            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <ul className="space-y-2.5 text-xs leading-relaxed text-slate-700">
                <li className="flex gap-2"><span className="text-violet-500">•</span><span>Your current details stay in place while you fill out the form.</span></li>
                <li className="flex gap-2"><span className="text-violet-500">•</span><span>When you submit, the new details replace them and go to admin review.</span></li>
                <li className="flex gap-2"><span className="text-violet-500">•</span><span>Demat orders may be unavailable until the new account is verified.</span></li>
              </ul>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 border-t border-slate-100 p-4 flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDematUpdateDialogOpen(false)}
              className="rounded-xl font-medium text-slate-700 border-slate-200 bg-white hover:bg-slate-100 h-10 px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsDematUpdateDialogOpen(false);
                router.push("/demat?update=1");
              }}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium h-10 px-5"
            >
              Continue to Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActiveSessionsDialog open={sessionsOpen} onOpenChange={setSessionsOpen} />
    </div>
  );
}
