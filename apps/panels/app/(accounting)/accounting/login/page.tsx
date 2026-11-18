"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, Mail, Lock, Loader2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";

export default function AccountingLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const { accountingAdmin, accountingLogin, isAccountingLoading, accountingError } = useAuthStore();
  const router = useRouter();

  // Clear any stale accounting state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().accountingAdmin !== null) {
      useAuthStore.getState().setAccountingAdmin(null);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (accountingAdmin && !accountingError) {
      router.replace("/accounting/dashboard");
    }
  }, [accountingAdmin, accountingError, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accountingLogin(email, password);
      router.replace("/accounting/dashboard");
    } catch (error) {
      // Error is handled by the store and displayed via accountingError
    }
  };

  // If authenticated, show simple redirect state (prevents race)
  if (accountingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#fafafa]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-[14px] text-gray-500 hover:text-[#16a34a] transition-colors font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </Link>

      <div className="w-full max-w-[440px] bg-white border border-[#f1f1f1] rounded-[28px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
          <div className="w-[48px] h-[48px] rounded-[14px] bg-[#16a34a] text-white flex items-center justify-center shadow-sm">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Accounting Panel</h1>
            <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">
              Sign in to manage your finances and invoices
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {accountingError && (
            <Alert variant="destructive" className="rounded-[12px] border-red-100 bg-red-50 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[12.5px]">{accountingError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-gray-800 font-bold text-[13px] block">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-11 border-gray-200 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 focus-visible:ring-[#16a34a] focus-visible:border-[#16a34a] rounded-[12px] bg-white text-gray-900 placeholder:text-gray-400/70 transition-all outline-none w-full"
                  disabled={isAccountingLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-gray-800 font-bold text-[13px] block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[12px] text-gray-400 hover:text-[#16a34a] transition-colors focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-10 h-11 border-gray-200 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 focus-visible:ring-[#16a34a] focus-visible:border-[#16a34a] rounded-[12px] bg-white text-gray-900 placeholder:text-gray-400/70 transition-all outline-none w-full"
                  disabled={isAccountingLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-[#16a34a] text-white hover:bg-[#15803d] active:bg-[#16a34a] rounded-[12px] font-semibold text-[14px] shadow-sm transition-all flex items-center justify-center gap-2 border-0 outline-none mt-6"
              disabled={isAccountingLoading}
            >
              {isAccountingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultEmail={email}
      />
    </div>
  );
}
