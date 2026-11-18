"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, Settings, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";

export default function OperationLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const { operationAdmin, operationLogin, isOperationLoading, operationError } = useAuthStore();
  const router = useRouter();

  // Clear any stale operation state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().operationAdmin !== null) {
      useAuthStore.getState().setOperationAdmin(null);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (operationAdmin && !operationError) {
      router.replace("/operation/dashboard");
    }
  }, [operationAdmin, operationError, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationLogin(email, password);
      router.replace("/operation/dashboard");
    } catch (error) {
      // Error is handled by the store and displayed via operationError
    }
  };

  // If authenticated, show simple redirect state (prevents race)
  if (operationAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#16A34A] mb-4" />
          <p className="text-sm font-semibold text-[#64748B]">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#FAFBFC]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm text-[#64748B] hover:text-[#16A34A] transition-colors font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </Link>

      <div className="w-full max-w-[420px] bg-white border border-neutral-200/40 rounded-[24px] p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        {/* Header */}
        <div className="flex flex-col items-center justify-center space-y-3.5 text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center shadow-xs border border-[#16A34A]/10">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Operations Panel</h1>
            <p className="text-xs font-semibold text-[#64748B] mt-1">
              Sign in to manage logistics and operations
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {operationError && (
            <Alert variant="destructive" className="rounded-xl border-red-100 bg-red-50 text-red-700 p-3">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs font-medium">{operationError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[#0F172A] font-bold text-xs block uppercase tracking-wide">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-11 border border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] rounded-xl bg-white text-[#0F172A] placeholder:text-[#64748B]/40 transition-all outline-none w-full text-sm"
                  disabled={isOperationLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[#0F172A] font-bold text-xs block uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs font-medium text-[#64748B] hover:text-[#16A34A] transition-colors focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-10 h-11 border border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] rounded-xl bg-white text-[#0F172A] placeholder:text-[#64748B]/40 transition-all outline-none w-full text-sm"
                  disabled={isOperationLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#16A34A] focus:outline-none"
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
              className="w-full h-11 bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:border-[#16A34A] hover:text-[#0F172A] active:scale-[0.98] transition-all duration-300 rounded-full font-bold text-xs tracking-wider flex items-center justify-center gap-2 outline-none mt-6 uppercase"
              disabled={isOperationLoading}
            >
              {isOperationLoading ? (
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

        {/* Secure Access Footer */}
        <div className="text-center mt-6">
          <p className="text-[11.5px] font-semibold text-[#64748B]/70 leading-normal">
            Standard secure access for authorized personnel only.
          </p>
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
