'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@/components/ui/floating-notification';
import { Lock, Mail, Loader2, Headphones, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';

import { useSupportAuth } from '@/hooks/use-support-auth';
import { useAuthStore } from '@/store/auth-store';
import { adminLoginSchema, type AdminLoginFormValues } from '@/lib/validations/admin-login-schema';

import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export default function SupportLoginPage() {
  const router = useRouter();
  const { supportAdmin, supportLogin, supportLogout, isSupportLoading, supportError } = useSupportAuth();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Clear any stale support state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().supportAdmin !== null) {
      useAuthStore.getState().setSupportAdmin(null);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (supportAdmin && !supportError) {
      router.replace('/support/dashboard');
    }
  }, [supportAdmin, supportError, router]);

  // Form setup
  const form = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema as any),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  });

  // Submit handler
  async function onSubmit(values: AdminLoginFormValues) {
    setIsSubmitting(true);
    setLoginAttempted(false);
    try {
      await supportLogin(values.email, values.password);
      setLoginAttempted(true);
      notify.success('Login successful!');
    } catch (error: any) {
      setLoginAttempted(true);
      notify.error(error.message || 'Login failed. Please try again.');
      form.setValue('password', '');
    } finally {
      setIsSubmitting(false);
    }
  }

  // If authenticated, show simple redirect state (prevents race)
  if (supportAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#16A34A] mb-4" />
          <p className="text-sm font-medium text-[#64748B]">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Render login form
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#FAFBFC]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm text-[#64748B] hover:text-[#16A34A] transition-colors font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </Link>

      <div className="w-full max-w-[440px] bg-white border border-neutral-200/40 rounded-[20px] p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        {/* Header */}
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
          <div className="h-12 w-12 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10 shadow-sm shrink-0">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Support Desk</h1>
            <p className="text-sm font-medium text-[#64748B] mt-1.5 leading-relaxed">
              Sign in to manage your support tickets
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {supportError && (
            <div className="rounded-[16px] bg-[#FEF2F2] border border-[#FCA5A5] p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-[#DC2626] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0F172A]">Login failed</p>
                <p className="text-[11px] font-semibold text-[#64748B] mt-0.5">{supportError}</p>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="on" className="space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[#0F172A] font-semibold text-xs">Email address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          autoFocus
                          className="pl-11 h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-[#0F172A] placeholder:text-[#64748B]/50 transition-all outline-none"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-[#0F172A] font-semibold text-xs">Password</FormLabel>
                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordOpen(true)}
                        className="text-xs text-[#64748B] hover:text-[#16A34A] transition-colors font-medium focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pl-11 pr-10 h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-[#0F172A] placeholder:text-[#64748B]/50 transition-all outline-none"
                          disabled={isSubmitting}
                          {...field}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full h-11 bg-[#16A34A] border-2 border-[#16A34A] text-white hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-[14px] font-bold text-sm shadow-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none mt-6"
                disabled={isSubmitting || isSupportLoading}
              >
                {isSubmitting || isSupportLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </Form>
        </div>

        {/* Secure Access Footer */}
        <div className="text-center mt-6">
          <p className="text-[11.5px] text-[#64748B] font-medium leading-normal">
            Standard secure access for authorized personnel only.
          </p>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultEmail={form.getValues("email")}
      />
    </div>
  );
}