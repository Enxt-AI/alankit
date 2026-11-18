"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  Zap,
  AlertCircle,
  Home,
  User,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { OTPForm } from "@/components/auth/otp-form";
import Link from "next/link";
import Image from "next/image";
import { z } from "zod";
import { getSignupStatus } from "@/lib/auth-api";

const nameSchema = z.string()
  .trim()
  .min(3, "Please enter your full name (at least 3 characters)")
  .max(100, "Your name must be at most 100 characters")
  .regex(/^[a-zA-Z][a-zA-Z\s]*$/, "Only alphabets and spaces are allowed in name");

const phoneSchema = z.string()
  .trim()
  .regex(/^(?!(\d)\1{9})(?:[6-9]\d{9}|0123456789)$/, "Please enter a valid 10-digit Indian phone number (starting with 6-9, not all identical)");

const emailSchema = z.string()
  .trim()
  .email("Please enter a valid email address");

/**
 * Auth steps:
 *  SIGNUP:  phone-input → phone-otp → email-input → email-otp → done
 *  LOGIN:   phone-input → phone-otp → done (existing user with email)
 *           email-input → email-otp → done (returning user logs in via email)
 */
type AuthStep =
  | "phone-input"
  | "phone-otp"
  | "email-input"
  | "email-otp"
  | "name-input";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLoading,
    phoneOtpRequest,
    needsEmail,
    tempPhone,
    phoneOtpSmsSent,
    phoneOtpDevFallbackAvailable,
    phoneOtpDeliveryMessage,
    emailOtpRequest,
    emailOtpVerify,
    tempEmail,
    setOTPStep,
  } = useAuthStore();

  const [currentStep, setCurrentStep] = useState<AuthStep>("phone-input");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fullName, setFullName] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const emailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const clearHandledRef = useRef(false);

  const startEmailCountdown = () => {
    if (emailIntervalRef.current) {
      clearInterval(emailIntervalRef.current);
      emailIntervalRef.current = null;
    }
    setEmailCountdown(60);
    emailIntervalRef.current = setInterval(() => {
      setEmailCountdown((prev) => {
        if (prev <= 1) {
          if (emailIntervalRef.current) {
            clearInterval(emailIntervalRef.current);
            emailIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (currentStep === "email-otp") {
      startEmailCountdown();
    }
    return () => {
      if (emailIntervalRef.current) {
        clearInterval(emailIntervalRef.current);
        emailIntervalRef.current = null;
      }
    };
  }, [currentStep]);

  // Resume uncompleted signup from the HttpOnly cookie and Redis, without a session.
  useEffect(() => {
    let cancelled = false;
    const resume = async () => {
      try {
        const pending = await getSignupStatus();
        if (cancelled) return;
        if (pending.step === "name" || pending.step === "email") {
          useAuthStore.setState({ needsEmail: true, tempPhone: pending.phone || null,
            tempEmail: pending.email || null, emailOtpStep: pending.step === "name" ? "name-input" : "idle" });
          setPhoneNumber(pending.phone || "");
          setEmail(pending.email || "");
          setCurrentStep(pending.step === "name" ? "name-input" : "email-input");
          return;
        }
        useAuthStore.setState({ needsEmail: false, tempPhone: null, tempEmail: null, emailOtpStep: "idle" });
        setCurrentStep("phone-input");
        const activePhone = localStorage.getItem("unlistedstox_active_otp_phone");
        if (activePhone && await useAuthStore.getState().checkOtpStatus(activePhone)) {
          if (!cancelled) { setPhoneNumber(activePhone); setCurrentStep("phone-otp"); }
        }
      } catch {
        // A transient status failure leaves the phone form available for a fresh attempt.
      }
    };
    void resume();
    return () => { cancelled = true; };
  }, []);

  // Redirect if authenticated
  useEffect(() => {
    if (searchParams.get("clear") === "true") {
      // A client navigation can bypass the proxy's cookie-clear redirect.
      // Consume this once so a successful re-login cannot trigger logout again.
      if (!clearHandledRef.current) {
        clearHandledRef.current = true;
        void useAuthStore.getState().logout().finally(() => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("clear");
          const query = params.toString();
          router.replace(query ? `/login?${query}` : "/login");
        });
      }
      return;
    }
    if (isAuthenticated && !needsEmail) {
      const returnUrl = searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    }
  }, [isAuthenticated, needsEmail, router, searchParams]);

  // When phone OTP verifies and user needs email → go to email-input
  useEffect(() => {
    if (needsEmail) {
      setCurrentStep(useAuthStore.getState().emailOtpStep === "name-input" ? "name-input" : "email-input");
    }
  }, [needsEmail]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ── Phone submit ──
  const handlePhoneSubmit = async () => {
    try {
      const validatedPhone = phoneSchema.parse(phoneNumber);
      setPhoneError("");
      setIsSubmitting(true);
      const result = await phoneOtpRequest(validatedPhone);
      setCurrentStep("phone-otp");
      if (result.smsSent === false) {
        console.log(result.message || "OTP generated for developer testing.");
      } else {
        // toast removed
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPhoneError(error.issues[0]?.message || "Invalid phone number");
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to send OTP";
        if (errorMessage.includes("ThrottlerException") || errorMessage.includes("Too Many Requests")) {
          setPhoneError("Too many requests. Please try again later.");
        } else {
          setPhoneError(errorMessage);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePhoneSubmit();
    }
  };

  // ── Phone OTP success ──
  const handlePhoneOtpSuccess = () => {
    const { needsEmail: ne } = useAuthStore.getState();
    if (ne) {
      setCurrentStep("email-input");
    } else {
      const returnUrl = searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    }
  };

  // ── Email submit ──
  const handleEmailSubmit = async () => {
    try {
      const validatedEmail = emailSchema.parse(email);
      setEmailError("");
      setIsSubmitting(true);
      await emailOtpRequest(validatedEmail, undefined, tempPhone || undefined);
      setCurrentStep("email-otp");
      // toast removed
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.issues[0]?.message || "Invalid email address");
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to send OTP";
        if (errorMessage.includes("ThrottlerException") || errorMessage.includes("Too Many Requests")) {
          setEmailError("Too many requests. Please try again later.");
        } else {
          setEmailError(errorMessage);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEmailSubmit();
    }
  };

  // ── Email OTP handlers ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value.slice(-1);
    setOtpValues(newValues);
    setOtpError("");
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
    if (value && index === 5) {
      const fullOtp = newValues.join("");
      if (fullOtp.length === 6) handleEmailOtpSubmit(fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pastedData.length === 6) {
      setOtpValues(pastedData.split(""));
      otpInputRefs.current[5]?.focus();
      handleEmailOtpSubmit(pastedData);
    }
  };

  const handleEmailOtpSubmit = async (otp?: string) => {
    const code = otp || otpValues.join("");
    if (code.length !== 6) {
      setOtpError("Please enter the complete 6-digit code");
      return;
    }
    try {
      setOtpError("");
      setIsSubmitting(true);
      // Pass the phone if this is part of the signup linking flow
      const phone = tempPhone || undefined;
      await emailOtpVerify(tempEmail || email, code, phone);
      const { emailOtpStep } = useAuthStore.getState();
      if (emailOtpStep === "name-input") {
        setCurrentStep("name-input");
        // toast removed
      } else {
        // toast removed
        const returnUrl = searchParams.get("returnUrl") || "/";
        router.push(returnUrl);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid verification code";
      if (errorMessage.includes("ThrottlerException") || errorMessage.includes("Too Many Requests")) {
        setOtpError("Too many requests. Please try again later.");
      } else {
        setOtpError(errorMessage);
      }
      setOtpValues(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmailOtp = async () => {
    try {
      setIsSubmitting(true);
      setOtpError("");
      await emailOtpRequest(tempEmail || email, undefined, tempPhone || undefined);
      setOtpValues(["", "", "", "", "", ""]);
      setEmailCountdown(30);
      otpInputRefs.current[0]?.focus();
      // toast removed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend OTP";
      if (errorMessage.includes("ThrottlerException") || errorMessage.includes("Too Many Requests")) {
        setOtpError("Too many requests. Please try again later.");
      } else {
        setOtpError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameSubmit = async () => {
    try {
      const validatedName = nameSchema.parse(fullName);
      setFullNameError("");
      setIsSubmitting(true);
      const { completeSignup } = useAuthStore.getState();
      await completeSignup({ fullName: validatedName });
      // toast removed
      const returnUrl = searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFullNameError(error.issues[0]?.message || "Invalid name format");
      } else {
        setFullNameError(
          error instanceof Error ? error.message : "Failed to update profile",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNameSubmit();
    }
  };

  // ── Step titles ──
  const stepTitle: Record<AuthStep, string> = {
    "phone-input": "Welcome",
    "phone-otp": "Verify Phone",
    "email-input": "Enter Email",
    "email-otp": "Verify Email",
    "name-input": "Complete Profile",
  };

  const stepDescription: Record<AuthStep, React.ReactNode> = {
    "phone-input": "Enter your phone number to get started",
    "phone-otp": (
      <>
        We've sent a 6-digit code to{" "}
        <span className="font-semibold text-slate-700">+91 {tempPhone || phoneNumber}</span>
        {" "}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("unlistedstox_active_otp_phone");
            }
            setCurrentStep("phone-input");
            setOTPStep("idle");
          }}
          className="text-[#0EA54F] font-semibold hover:underline cursor-pointer"
        >
          (Edit)
        </button>
      </>
    ),
    "email-input": "Link your email to complete sign-up",
    "email-otp": (
      <>
        We've sent a 6-digit code to{" "}
        <span className="font-semibold text-slate-700">{tempEmail || email}</span>
        {" "}
        <button
          type="button"
          onClick={() => {
            setCurrentStep("email-input");
            setOtpError("");
            setOtpValues(["", "", "", "", "", ""]);
          }}
          className="text-[#0EA54F] font-semibold hover:underline cursor-pointer"
        >
          (Edit)
        </button>
      </>
    ),
    "name-input": "Please enter your full name to finish registration",
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-white">
      {/* Left Column: Branding - Fixed on desktop, non-scrollable */}
      <div className="relative hidden lg:flex lg:flex-col p-6 xl:p-8 2xl:p-10 bg-[#f4faf7] border-r border-emerald-50 lg:w-[45%] xl:w-[40%] lg:h-screen overflow-hidden">
        <div className="relative flex flex-col h-full justify-between max-w-lg mx-auto w-full">
          <div>
            <Image
              src="/logo.png"
              alt="UnlistedSTOX"
              width={240}
              height={50}
              className="h-9 lg:h-10 w-auto object-contain"
            />
          </div>

          <div className="my-auto py-4">
            <h1 className="text-[30px] xl:text-[34px] font-extrabold text-[#1A2530] tracking-tight mb-2 leading-[1.16]">
              Invest in <br/>
              <span className="text-green-600">Pre-IPO & Unlisted</span><br/>
              Shares
            </h1>
            <p className="text-[13px] xl:text-[14px] text-slate-500 leading-relaxed max-w-sm mb-4">
              Join thousands of investors accessing high-growth opportunities before they go public.
            </p>
            
            {/* Bull Graphic */}
            <div className="relative flex justify-center items-center w-full max-w-[360px] mb-3 mx-auto">
              <Image
                src="/bull.png"
                alt="Bull Graphic"
                width={420}
                height={180}
                className="w-full max-w-[300px] xl:max-w-[340px] h-auto object-contain relative z-10 mix-blend-multiply"
                priority
              />
            </div>

            {/* Security Badges in white cards */}
            <div className="space-y-2.5 relative z-20">
              <div className="rounded-xl p-3 flex items-center gap-3 transition-all">
                <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-md border border-slate-100/60 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-600" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-bold text-[#1A2530] text-[13px] leading-snug">
                    Institutional Grade Security
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Your investments and data are protected by top-tier encryption.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-3 flex items-center gap-3 transition-all">
                <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-md border border-slate-100/60 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-bold text-[#1A2530] text-[13px] leading-snug">
                    Lightning Fast Execution
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Experience seamless, near-instant transaction processing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Auth Flow - Fits screen without scroll */}
      <div className="flex-1 bg-white relative overflow-hidden h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="absolute top-6 right-6 hidden md:block">
           <Link href="/" className="flex items-center gap-2 text-green-600 font-semibold text-sm hover:text-green-700 transition-colors">
              <Home className="w-4 h-4" strokeWidth={2.5} />
              Back to Home
           </Link>
        </div>

        <div className="h-full flex flex-col justify-between items-center max-w-[400px] mx-auto w-full py-2">
          <div className="w-full space-y-4 my-auto">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-2">
              <Image
                src="/logo.png"
                alt="UnlistedSTOX"
                width={160}
                height={32}
                className="object-contain h-8"
                style={{ width: "auto" }}
              />
            </div>

            {searchParams.get("deactivated") === "true" && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs sm:text-sm text-amber-800 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <h5 className="font-bold text-amber-900">Account Deactivated</h5>
                  <p className="mt-0.5 text-amber-700/90 leading-relaxed">
                    Your account has been deactivated successfully. You can reactivate it at any time by logging back in.
                  </p>
                </div>
              </div>
            )}

            {searchParams.get("deleted") === "true" && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs sm:text-sm text-rose-700 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <h5 className="font-bold text-rose-800">Account Deleted</h5>
                  <p className="mt-0.5 text-rose-700/90 leading-relaxed">
                    Your account deletion request has been processed successfully. We're sorry to see you go.
                  </p>
                </div>
              </div>
            )}

            <div className="transition-all duration-500">
              {/* Progress indicator for signup */}
              {(currentStep === "email-input" || currentStep === "email-otp") &&
                needsEmail && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#0EA54F] text-white text-xs flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <span className="text-xs font-medium text-[#0EA54F]">
                        Phone
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-[#0EA54F]" />
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold",
                          currentStep === "email-otp"
                            ? "bg-[#0EA54F] text-white"
                            : "bg-[#0EA54F]/20 text-[#0EA54F]",
                        )}
                      >
                        2
                      </div>
                      <span className="text-xs font-medium text-gray-500">
                        Email
                      </span>
                    </div>
                  </div>
                )}    


              {currentStep !== "phone-otp" && (
                <div className="space-y-2 mb-4 text-center sm:text-left">
                  {currentStep === "phone-input" && (
                    <div className="w-12 h-12 rounded-[16px] border-[1.5px] border-green-600 bg-green-50/50 flex items-center justify-center mb-3 mx-auto sm:mx-0">
                      <User className="w-5 h-5 text-green-600" strokeWidth={2.5} />
                    </div>
                  )}
                  <h2 className="text-[24px] sm:text-[28px] font-black tracking-tight text-[#1A2530]">
                    {stepTitle[currentStep]}
                  </h2>
                  <p className="text-slate-500 text-[13px] sm:text-[14px] leading-relaxed">
                    {stepDescription[currentStep]}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {/* ── STEP 1: Phone Input ── */}
                {currentStep === "phone-input" && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label
                        htmlFor="phone"
                        className="text-[13px] font-bold text-slate-700 ml-1"
                      >
                        Phone Number
                      </Label>
                      <div className="relative group flex items-center">
                        <span className="absolute left-4 text-[15px] font-semibold text-slate-700 flex items-center gap-2 pointer-events-none">
                          +91 <span className="w-px h-5 bg-slate-200 mx-1" />
                        </span>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="98765 43210"
                          maxLength={10}
                          className={cn(
                            "pl-24 h-14 text-[17px] bg-white border border-green-500 rounded-xl focus:bg-white outline-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500/10 focus-visible:border-green-600 shadow-sm transition-all text-slate-800",
                            phoneError &&
                              "border-2 border-red-500 focus-visible:ring-red-500",
                          )}
                          value={phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setPhoneNumber(val);
                            if (phoneError) setPhoneError("");
                          }}
                          onKeyDown={handlePhoneKeyDown}
                          autoFocus
                        />
                      </div>
                      {phoneError && (
                        <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 p-3.5 text-xs sm:text-sm text-rose-800 animate-in fade-in slide-in-from-top-1 duration-300">
                          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-rose-600" />
                          <div className="flex-1 font-medium leading-relaxed">{phoneError}</div>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-[17px] font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5"
                      onClick={handlePhoneSubmit}
                      disabled={isSubmitting || isLoading}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Sending...
                        </div>
                      ) : (
                        <>
                          Continue <ArrowRight className="ml-2 h-[18px] w-[18px]" strokeWidth={2.5} />
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* ── STEP 2: Phone OTP ── */}
                {currentStep === "phone-otp" && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <OTPForm
                      mode="public"
                      onSuccess={handlePhoneOtpSuccess}
                      onError={() => {}}
                      onCancel={() => {
                        if (typeof window !== "undefined") {
                          localStorage.removeItem("unlistedstox_active_otp_phone");
                        }
                        setCurrentStep("phone-input");
                        setOTPStep("idle");
                      }}
                      phoneNumber={tempPhone || phoneNumber}
                      devHint={
                        phoneOtpSmsSent === false ||
                        phoneOtpDevFallbackAvailable
                          ? phoneOtpDeliveryMessage || undefined
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* ── STEP 3: Email Input (signup) ── */}
                {currentStep === "email-input" && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="email"
                        className="text-sm font-semibold text-gray-700 ml-1"
                      >
                        Email Address
                      </Label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#0EA54F] transition-colors" />
                        </div>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          className={cn(
                            "pl-12 h-14 text-lg bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:border-green-600 focus-visible:ring-offset-0 shadow-none transition-all",
                            emailError &&
                              "border-2 border-red-500 focus-visible:ring-red-500",
                          )}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) setEmailError("");
                          }}
                          onKeyDown={handleEmailKeyDown}
                          autoFocus
                        />
                      </div>
                      {emailError && (
                        <p className="text-sm font-medium text-red-500 ml-1">
                          {emailError}
                        </p>
                      )}
                    </div>
                    <Button
                      className="w-full h-14 bg-[#0EA54F] hover:bg-[#0C8F44] text-white text-lg font-bold rounded-2xl shadow-lg shadow-[#0EA54F]/20 transition-all hover:-translate-y-0.5"
                      onClick={handleEmailSubmit}
                      disabled={isSubmitting || isLoading}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Sending...
                        </div>
                      ) : (
                        <>
                          Verify Email <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* ── STEP 4: Email OTP ── */}
                {currentStep === "email-otp" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-center gap-3">
                      {otpValues.map((value, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={value}
                          onChange={(e) =>
                            handleOtpChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          className={cn(
                            "w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl bg-gray-50 focus:bg-white focus:border-[#0EA54F] focus:ring-4 focus:ring-[#0EA54F]/10 outline-none transition-all",
                            otpError
                              ? "border-red-400"
                              : value
                                ? "border-[#0EA54F]"
                                : "border-gray-200",
                          )}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                    {otpError && (
                      <p className="text-sm font-medium text-red-500 text-center">
                        {otpError}
                      </p>
                    )}
                    <Button
                      className="w-full h-14 bg-[#0EA54F] hover:bg-[#0C8F44] text-white text-lg font-bold rounded-2xl shadow-lg shadow-[#0EA54F]/20 transition-all hover:-translate-y-0.5"
                      onClick={() => handleEmailOtpSubmit()}
                      disabled={isSubmitting || isLoading || otpValues.join("").length !== 6}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Verifying...
                        </div>
                      ) : (
                        "Verify & Sign In"
                      )}
                    </Button>
                    <div className="text-center">
                      {emailCountdown > 0 ? (
                        <span className="text-sm text-gray-400 tabular-nums">
                          Resend OTP in{" "}
                          <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium text-xs">
                            {emailCountdown}s
                          </span>
                        </span>
                      ) : (
                        <button
                          onClick={handleResendEmailOtp}
                          disabled={isSubmitting || isLoading}
                          className="text-sm text-gray-500 hover:text-[#0EA54F] font-medium transition-colors disabled:opacity-50"
                        >
                          Didn&apos;t receive the code?{" "}
                          <span className="text-[#0EA54F] font-semibold">
                            Resend
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── STEP 5: Name Input ── */}
                {currentStep === "name-input" && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="fullName"
                        className="text-sm font-semibold text-gray-700 ml-1"
                      >
                        Full Name
                      </Label>
                      <div className="relative group">
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="John Doe"
                          className={cn(
                            "h-14 text-lg bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:border-green-600 focus-visible:ring-offset-0 shadow-none transition-all",
                            fullNameError &&
                              "border-2 border-red-500 focus-visible:ring-red-500",
                          )}
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (fullNameError) setFullNameError("");
                          }}
                          onKeyDown={handleNameKeyDown}
                          autoFocus
                        />
                      </div>
                      {fullNameError && (
                        <p className="text-sm font-medium text-red-500 ml-1">
                          {fullNameError}
                        </p>
                      )}
                    </div>
                    <Button
                      className="w-full h-14 bg-[#0EA54F] hover:bg-[#0C8F44] text-white text-lg font-bold rounded-2xl shadow-lg shadow-[#0EA54F]/20 transition-all hover:-translate-y-0.5"
                      onClick={handleNameSubmit}
                      disabled={isSubmitting || isLoading}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Saving...
                        </div>
                      ) : (
                        <>
                          Complete Registration{" "}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center space-y-3 mt-3">
              <p className="text-[12px] text-slate-500 px-2">
                By continuing, you agree to our{" "}
                <Link
                  href="/legal-policies/terms-and-conditions"
                  className="text-green-600 font-bold hover:underline decoration-2 underline-offset-4"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/legal-policies/privacy-policy"
                  className="text-green-600 font-bold hover:underline decoration-2 underline-offset-4"
                >
                  Privacy Policy
                </Link>.
              </p>
              
              <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-2 relative">
                <div className="absolute -top-3 bg-white px-3">
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-[12px] font-bold text-slate-600">
                  Secure. Compliant. Trusted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
