'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@/components/ui/floating-notification';
import { Lock, Mail, LogIn, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

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

export default function AdminLoginPage() {
  const router = useRouter();
  const adminLogin = useAuthStore((state) => state.adminLogin);
  const admin = useAuthStore((state) => state.admin);
  const isAdmin = admin !== null && (admin.role === 'ADMIN' || admin.role === 'SUPER_ADMIN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Clear any stale admin state on mount to prevent infinite client-side redirect loops
  useEffect(() => {
    if (useAuthStore.getState().admin !== null) {
      useAuthStore.getState().setAdmin(null);
    }
  }, []);

  // Redirect if already authenticated (simplified, no heavy loader)
  useEffect(() => {
    if (isAdmin) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Login] Already authenticated, redirecting to dashboard');
      }
      // Use replace to avoid back-button returning to login page
      router.replace('/admin/dashboard', { scroll: false });
    }
  }, [isAdmin, router]);  // Deps ensure it runs only on change

  // Form setup
  const form = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema as any),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  });

  // Submit handler (no timeout, direct redirect)
  async function onSubmit(values: AdminLoginFormValues) {
    setIsSubmitting(true);
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Login] Attempting login for:', values.email);
      }

      await adminLogin(values.email, values.password);

      const loggedInAdmin = useAuthStore.getState().admin;
      if (
        loggedInAdmin &&
        loggedInAdmin.role !== 'ADMIN' &&
        loggedInAdmin.role !== 'SUPER_ADMIN'
      ) {
        useAuthStore.getState().setAdmin(null);
        notify.error(
          `Access denied. Your account role (${loggedInAdmin.role}) does not have Admin privileges. Please log in at your designated panel.`
        );
        form.setValue('password', '');
        setIsSubmitting(false);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Login] Login successful, redirecting...');
      }

      notify.success('Login successful!');

      // Direct redirect after success (replace to avoid polluting history)
      router.replace('/admin/dashboard');
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Admin Login] Login failed:', error);
      }

      notify.error(error.message || 'Login failed. Please try again.');

      form.setValue('password', '');
      setIsSubmitting(false);
    }
  }

  // If authenticated, show simple redirect state (prevents race)
  if (isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#16a34a] mb-4" />
          <p className="text-slate-600 font-medium text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Render form
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
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Admin Login</h1>
            <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">
              Sign in to access the admin panel
            </p>
          </div>
        </div>

        <div>
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
                className="w-full h-11 bg-[#16a34a] text-white hover:bg-[#15803d] active:bg-[#16a34a] rounded-[12px] font-semibold text-[14px] shadow-sm transition-all flex items-center justify-center gap-2 border-0 outline-none mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
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
