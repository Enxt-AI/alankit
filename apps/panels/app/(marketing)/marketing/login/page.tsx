'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@/components/ui/floating-notification';
import { Lock, Mail, LogIn, Loader2, LogOut, Target, ArrowLeft, Eye, EyeOff } from 'lucide-react';

import { useMarketingAuth } from '@/hooks/use-marketing-auth';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MarketingLoginPage() {
  const router = useRouter();
  const { marketingAdmin, marketingLogin, marketingLogout, isMarketingLoading, marketingError } = useMarketingAuth();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Clear any stale marketing state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().marketingAdmin !== null) {
      useAuthStore.getState().setMarketingAdmin(null);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (marketingAdmin && !marketingError) {
      router.replace('/marketing/dashboard');
    }
  }, [marketingAdmin, marketingError, router]);

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
      await marketingLogin(values.email, values.password);
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

  // Logout handler
  const handleLogout = async () => {
    try {
      await marketingLogout();
      setLoginAttempted(false);
      notify.success('Logged out successfully');
    } catch (error: any) {
      notify.error('Logout failed');
    }
  };

  // If authenticated, show simple redirect state (prevents race)
  if (marketingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-white">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Render login form
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
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Marketing Hub</h1>
            <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">
              Sign in to manage your marketing campaigns
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {marketingError && (
            <Alert variant="destructive" className="rounded-[12px] border-red-100 bg-red-50 text-red-700">
              <AlertDescription className="text-[12.5px]">{marketingError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="on" className="space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-gray-800 font-bold text-[13px]">Email address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          autoFocus
                          className="pl-11 h-11 border-gray-200 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 focus-visible:ring-[#16a34a] focus-visible:border-[#16a34a] rounded-[12px] bg-white text-gray-900 placeholder:text-gray-400/70 transition-all outline-none"
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
                      <FormLabel className="text-gray-800 font-bold text-[13px]">Password</FormLabel>
                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordOpen(true)}
                        className="text-[12px] text-gray-400 hover:text-[#16a34a] transition-colors focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pl-11 pr-10 h-11 border-gray-200 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 focus-visible:ring-[#16a34a] focus-visible:border-[#16a34a] rounded-[12px] bg-white text-gray-900 placeholder:text-gray-400/70 transition-all outline-none"
                          disabled={isSubmitting}
                          {...field}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-[#16A34A] text-white border-2 border-[#16A34A] hover:bg-white hover:text-[#0F172A] hover:border-[#16A34A] hover:shadow-[0_8px_20px_rgba(22,163,74,0.12)] active:scale-[0.98] rounded-[12px] font-semibold text-[14px] transition-all duration-300 ease-in-out flex items-center justify-center gap-2 outline-none mt-6"
                disabled={isSubmitting || isMarketingLoading}
              >
                {isSubmitting || isMarketingLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" style={{ color: '#16A34A' }} />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Secure Access Footer */}
        <div className="text-center mt-6">
          <p className="text-[11.5px] text-gray-400/90 leading-normal">
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