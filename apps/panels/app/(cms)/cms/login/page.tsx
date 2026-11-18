'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@/components/ui/floating-notification';
import { Lock, Mail, Loader2, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

import { useCMSAuth } from '@/hooks/use-cms-auth';
import { useAuthStore } from '@/store/auth-store';
import { adminLoginSchema, type AdminLoginFormValues } from '@/lib/validations/admin-login-schema';
import { cmsOtpSchema, type CmsOTPFormValues } from '@/lib/validations/otp-schema';

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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CMSLoginPage() {
  const router = useRouter();
  const { cmsAdmin, cmsLogin, cmsVerifyOtp, isLoading, error } = useCMSAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [savedCredentials, setSavedCredentials] = useState<AdminLoginFormValues | null>(null);

  // OTP state - 6 individual digits
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');

  // Resend OTP state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Clear any stale CMS state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().cmsAdmin !== null) {
      useAuthStore.getState().setCMSAdmin(null);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (cmsAdmin && !error && step === 1) {
      router.replace('/cms/dashboard');
    }
  }, [cmsAdmin, error, router, step]);

  // Auto-focus first OTP input when step changes to 2 & start resend cooldown
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      // Start the initial 30s cooldown when OTP is first sent
      startResendCooldown();
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [step]);

  // Start 30-second resend cooldown
  const startResendCooldown = useCallback(() => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Resend OTP handler — re-calls cmsLogin which re-triggers sendCmsOtp
  const handleResendOtp = async () => {
    if (!savedCredentials || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await cmsLogin(savedCredentials.email, savedCredentials.password);
      notify.success('A new OTP has been sent to your email.');
      setOtpValues(['', '', '', '', '', '']);
      setOtpError('');
      inputRefs.current[0]?.focus();
      startResendCooldown();
    } catch (error: any) {
      notify.error(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Form setup for Email/Password
  const form = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema as any),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  });

  // Form setup for OTP (kept for potential future use)
  const otpForm = useForm<CmsOTPFormValues>({
    resolver: zodResolver(cmsOtpSchema),
    defaultValues: {
      otp: '',
    },
    mode: 'onSubmit',
  });

  // OTP input handlers
  const handleOtpChange = useCallback((index: number, value: string) => {
    // Only allow single digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    
    setOtpValues(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setOtpError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpValues[index] && index > 0) {
        // If current field is empty, go back and clear previous
        setOtpValues(prev => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current field
        setOtpValues(prev => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otpValues]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pastedData) {
      const newValues = ['', '', '', '', '', ''];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newValues[i] = pastedData[i] ?? '';
      }
      setOtpValues(newValues);
      setOtpError('');
      // Focus the next empty field or the last field
      const nextEmpty = newValues.findIndex(v => !v);
      inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    }
  }, []);

  // Submit handler for Step 1
  async function onSubmit(values: AdminLoginFormValues) {
    setIsSubmitting(true);
    try {
      const response = await cmsLogin(values.email, values.password);
      if (response && response.requiresOtp) {
        setSavedCredentials(values);
        setStep(2);
        notify.success('OTP sent to your email.');
      } else {
        notify.success('Login successful!');
        router.replace('/cms/dashboard');
      }
    } catch (error: any) {
      notify.error(error.message || 'Login failed. Please try again.');
      form.setValue('password', '');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit handler for Step 2 (OTP)
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = otpValues.join('');
    
    if (otp.length !== 6 || !/^[0-9]{6}$/.test(otp)) {
      setOtpError('OTP must be exactly 6 digits');
      return;
    }

    if (!savedCredentials) return;
    setIsSubmitting(true);
    try {
      await cmsVerifyOtp(savedCredentials.email, savedCredentials.password, otp);
      notify.success('Login successful!');
      router.replace('/cms/dashboard');
    } catch (error: any) {
      notify.error(error.message || 'OTP verification failed. Please try again.');
      setOtpValues(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle back to login step
  const handleBackToLogin = () => {
    setStep(1);
    setOtpValues(['', '', '', '', '', '']);
    setOtpError('');
    otpForm.reset();
  };

  // If authenticated on mount, show simple redirect state (prevents race)
  if (cmsAdmin && step === 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#16A34A] mb-4" />
          <p className="text-[#64748B] font-medium text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Render login form
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#FAFBFC]">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 bg-white border border-neutral-200 text-[#64748B] hover:bg-[#ECFDF5] hover:border-[#16A34A] hover:text-[#0F172A] rounded-xl font-semibold text-xs px-3.5 py-2 transition-all duration-300 ease-in-out active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </Link>

      <div 
        className="w-full max-w-[440px] bg-white border border-neutral-200/40 rounded-[24px] p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
      >
        {/* Header */}
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center border border-[#16A34A]/10">
            {step === 1 ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              {step === 1 ? 'SMC CMS Login' : 'Two-Factor Verification'}
            </h1>
            <p className="text-sm font-medium text-[#64748B] mt-1">
              {step === 1 
                ? 'Sign in to access the Content Management System' 
                : 'Enter the 6-digit code sent to your email'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/50 text-red-800">
              <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
            </Alert>
          )}

          {step === 1 ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="on" className="space-y-5">
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            autoComplete="email"
                            autoFocus
                            className="pl-11 h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-500 font-medium" />
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
                        <FormLabel className="font-semibold text-xs text-[#0F172A] uppercase tracking-wider">Password</FormLabel>
                        <button
                          type="button"
                          onClick={() => setIsForgotPasswordOpen(true)}
                          className="text-xs font-medium text-[#64748B] hover:text-[#16A34A] transition-colors focus:outline-none"
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
                            className="pl-11 pr-10 h-11 border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 focus-visible:ring-[#16A34A]/20 focus-visible:border-[#16A34A] rounded-[14px] bg-white text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-300"
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
                      <FormMessage className="text-xs text-red-500 font-medium" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none mt-6"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              {/* Custom OTP Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                  {/* First group of 3 */}
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpValues[index]}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={isSubmitting}
                      className={`w-12 h-14 text-center text-xl font-semibold rounded-xl border-2 bg-white text-[#0F172A] outline-none transition-all duration-200
                        ${otpValues[index] 
                          ? 'border-[#16A34A] ring-2 ring-[#16A34A]/20' 
                          : 'border-neutral-200 hover:border-neutral-300'}
                        focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                  ))}
                  
                  {/* Separator */}
                  <div className="w-3 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-neutral-300" />
                  </div>
                  
                  {/* Second group of 3 */}
                  {[3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpValues[index]}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={isSubmitting}
                      className={`w-12 h-14 text-center text-xl font-semibold rounded-xl border-2 bg-white text-[#0F172A] outline-none transition-all duration-200
                        ${otpValues[index] 
                          ? 'border-[#16A34A] ring-2 ring-[#16A34A]/20' 
                          : 'border-neutral-200 hover:border-neutral-300'}
                        focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                  ))}
                </div>

                {/* Error message */}
                {otpError && (
                  <p className="text-center text-xs text-red-500 font-medium">{otpError}</p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] active:scale-[0.98] rounded-xl font-semibold text-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                {/* Resend OTP */}
                <div className="flex items-center justify-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs font-medium text-[#64748B]">
                      Resend OTP in <span className="text-[#16A34A] font-bold tabular-nums">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending || isSubmitting}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] hover:text-[#15803D] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {isResending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {isResending ? 'Sending...' : "Didn't receive the code? Resend OTP"}
                    </button>
                  )}
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  disabled={isSubmitting || isLoading}
                  className="w-full h-11 text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAFBFC] rounded-xl font-semibold text-sm transition-all duration-300 ease-in-out flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Secure Access Footer */}
        <div className="text-center mt-6">
          <p className="text-[11px] font-medium text-[#64748B] leading-normal">
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