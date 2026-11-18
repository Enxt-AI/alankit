"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  phoneSchema,
  otpSchema,
  type PhoneFormValues,
  type OTPFormValues,
} from "@/lib/validations/otp-schema";
import { getPhoneOtpStatus } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { ArrowLeft, Loader2, Smartphone, ShieldCheck } from "lucide-react";

interface OTPFormProps {
  mode?: "public" | "guarded";
  onSuccess: () => void;
  onError?: () => void;
  onCancel?: () => void;
  phoneNumber?: string;
  devHint?: string;
}

export function OTPForm({
  mode = "guarded",
  onSuccess,
  onError,
  onCancel,
  phoneNumber,
  devHint,
}: OTPFormProps) {
  const otpStep = useAuthStore((state) => state.otpStep);
  const otpMobile = useAuthStore((state) => state.otpMobile);
  const tempPhone = useAuthStore((state) => state.tempPhone);
  const requestOTP = useAuthStore((state) => state.requestOTP);
  const verifyOTP = useAuthStore((state) => state.verifyOTP);
  const phoneOtpRequest = useAuthStore((state) => state.phoneOtpRequest);
  const phoneOtpVerify = useAuthStore((state) => state.phoneOtpVerify);
  const setOTPStep = useAuthStore((state) => state.setOTPStep);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [countdown, setCountdown] = useState(0);
  const [showDevOtpHelp, setShowDevOtpHelp] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Phone form setup
  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema as any),
    mode: "onChange",
    defaultValues: {
      mobile: "",
    },
  });

  // OTP form setup
  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema as any),
    mode: "onChange",
    defaultValues: {
      mobile: (mode === "public" ? phoneNumber : otpMobile) || "",
      otp: "",
    },
  });

  // Update OTP form mobile when otpMobile or phoneNumber changes
  useEffect(() => {
    if (mode === "public" && phoneNumber) {
      otpForm.setValue("mobile", phoneNumber);
    } else if (otpMobile) {
      otpForm.setValue("mobile", otpMobile);
    }
  }, [otpMobile, phoneNumber, mode, otpForm]);

  const storeCooldownUntil = useAuthStore((state) => state.cooldownUntil);
  const checkOtpStatus = useAuthStore((state) => state.checkOtpStatus);
  const phoneOtpDeliveryMessage = useAuthStore((state) => state.phoneOtpDeliveryMessage);

  // Helper to start/restart countdown timer based on server target timestamp
  const startCountdown = (targetTimestamp?: number | null) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const targetTime = targetTimestamp || storeCooldownUntil || (Date.now() + 30000);
    const initialRem = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
    setCountdown(initialRem);

    if (initialRem <= 0) return;

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);
  };

  // Check saved active OTP in Redis on mount / initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activePhone = localStorage.getItem("unlistedstox_active_otp_phone");
      if (activePhone && otpStep !== "otp") {
        checkOtpStatus(activePhone);
      }
    }
  }, []);

  // Queue acceptance is not delivery. Surface background failures while waiting.
  useEffect(() => {
    const phone = phoneNumber || tempPhone;
    if (mode !== "public" || !phone || otpStep !== "otp") return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const poll = async () => {
      // Hard cap: the OTP itself expires after 5 minutes.
      if (Date.now() - startedAt > 300000) return stop();
      const status = await getPhoneOtpStatus(phone);
      if (cancelled) return;
      if (status.deliveryStatus === "failed") {
        useAuthStore.setState({ phoneOtpDeliveryMessage: "We couldn't send the OTP. Please tap Resend OTP to get a new code.", phoneOtpSmsSent: false });
        stop();
      } else if (status.deliveryStatus === "accepted") {
        useAuthStore.setState({ phoneOtpDeliveryMessage: "OTP sent successfully. It is valid for 5 minutes.", phoneOtpSmsSent: true });
        stop();
      } else if (!status.hasActiveOTP) {
        stop();
      }
    };
    timer = setInterval(() => { void poll(); }, 5000);
    void poll();
    return () => { cancelled = true; stop(); };
  }, [mode, phoneNumber, tempPhone, otpStep, storeCooldownUntil]);

  // Countdown timer for resend button
  useEffect(() => {
    if (otpStep === "otp") {
      startCountdown(storeCooldownUntil);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [otpStep, storeCooldownUntil]);

  // Manage focus explicitly to avoid aria-hidden focus warnings in Radix Dialog
  useEffect(() => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }

    // Delay focus until after Dialog open/step transition animations settle
    const shouldFocusOtp = mode === "public" || otpStep === "otp";
    focusTimeoutRef.current = setTimeout(() => {
      if (shouldFocusOtp) {
        otpInputRef.current?.focus();
      } else {
        phoneInputRef.current?.focus();
      }
    }, 250);

    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [mode, otpStep]);

  // Phone form submit handler
  const onPhoneSubmit = async (data: PhoneFormValues) => {
    try {
      await requestOTP(data.mobile);
      // toast removed
    } catch (error: any) {
      console.error(error);
    }
  };

  // OTP form submit handler
  const onOTPSubmit = async (data: OTPFormValues) => {
    try {
      if (mode === "public") {
        await phoneOtpVerify(phoneNumber || data.mobile, data.otp);
      } else {
        await verifyOTP(data.mobile, data.otp);
      }
      // toast removed
      onSuccess();
    } catch (error: any) {
      console.error(error);
      onError?.();
    }
  };

  // Resend OTP handler
  const handleResendOTP = async () => {
    const phoneToUse = mode === "public" ? phoneNumber || tempPhone : otpMobile;
    if (!phoneToUse) return;

    try {
      if (mode === "public") {
        await phoneOtpRequest(phoneToUse);
      } else {
        await requestOTP(phoneToUse);
      }
      // toast removed
      startCountdown();
    } catch (error: any) {
      console.error(error);
    }
  };

  // Handle back to phone form
  const handleBackToPhone = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("unlistedstox_active_otp_phone");
    }
    setOTPStep("phone");
    phoneForm.reset();
    otpForm.reset();
    useAuthStore.getState().clearError();
    if (onCancel) {
      onCancel();
    }
  };

  if (mode === "guarded" && (otpStep === "idle" || otpStep === "phone")) {
    const { ref: mobileRegisterRef, ...mobileRegister } =
      phoneForm.register("mobile", {
        onChange: (e) => {
          e.target.value = e.target.value.replace(/\D/g, "");
        },
      });

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-center space-y-1.5">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
            <Smartphone className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Verify Your Phone</h3>
          <p className="text-sm text-gray-500">
            Enter your mobile number to receive a verification code
          </p>
        </div>

        <form
          onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="mobile"
              className="text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              Mobile Number
            </Label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-semibold text-gray-500 border-r pr-2.5 border-gray-200 select-none">
                +91
              </span>
              <Input
                id="mobile"
                type="tel"
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
                disabled={isLoading}
                autoComplete="tel"
                inputMode="numeric"
                enterKeyHint="send"
                className="pl-14 font-medium"
                {...mobileRegister}
                ref={(el) => {
                  mobileRegisterRef(el);
                  phoneInputRef.current = el;
                }}
              />
            </div>
            {phoneForm.formState.errors.mobile && (
              <p className="text-xs text-red-500">
                {phoneForm.formState.errors.mobile.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm"
            disabled={isLoading || !phoneForm.formState.isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send OTP"
            )}
          </Button>
        </form>
      </div>
    );
  }

  const showDevOption =
    mode === "public" && process.env.NODE_ENV !== "production";

  // If SMS couldn't be delivered (devHint provided), hide OTP input for normal users.
  // Developers can reveal it by explicitly opting in.
  const hideOtpUntilDevOptIn = showDevOption && !!devHint;
  const showOtpEntry = !hideOtpUntilDevOptIn || showDevOtpHelp;

  // Render OTP verification form
  if ((mode === "guarded" && otpStep === "otp") || mode === "public") {
    const { ref: otpRegisterRef, ...otpRegister } = otpForm.register("otp");

    return (
      <div className="space-y-3.5">
        <div className="text-center space-y-1">
          <div className="mx-auto w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Enter OTP</h3>
          <p className="text-xs sm:text-sm text-gray-500 flex items-center justify-center gap-1.5 flex-wrap">
            <span>We've sent a 6-digit code to</span>
            <span className="font-semibold text-gray-800">
              {phoneNumber ? (phoneNumber.startsWith('+91') ? phoneNumber : `+91 ${phoneNumber}`) : `+91 ${otpMobile}`}
            </span>
            <button
              type="button"
              onClick={handleBackToPhone}
              className="inline-flex items-center text-xs font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors ml-1 cursor-pointer"
              title="Edit Phone Number"
            >
              (Edit)
            </button>
          </p>
        </div>

        {phoneOtpDeliveryMessage && (
          <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 p-2.5 text-xs text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium leading-relaxed">
              {phoneOtpDeliveryMessage}
            </div>
          </div>
        )}

        {devHint && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 p-2.5 text-xs text-amber-900 shadow-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1 font-medium leading-relaxed">{devHint}</div>
          </div>
        )}

        {showDevOption && (
          <div className="rounded-xl border border-dashed border-gray-200 p-2.5 bg-gray-50/50">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={showDevOtpHelp}
                onChange={(e) => setShowDevOtpHelp(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Developer mode — use OTP from server console
            </label>
            {showDevOtpHelp && (
              <p className="text-[11px] text-gray-500 mt-1 pl-5 font-normal leading-relaxed">
                Check your backend logs for “Phone OTP for 98xxxx: 123456” and
                paste the code below.
              </p>
            )}
          </div>
        )}

        {showOtpEntry ? (
          <form
            onSubmit={otpForm.handleSubmit(onOTPSubmit)}
            className="space-y-3.5"
          >
            <div className="flex flex-col items-center gap-3">
              <Controller
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <InputOTP
                    maxLength={6}
                    value={field.value}
                    onChange={(val) => {
                      const cleanVal = val.replace(/\D/g, "");
                      field.onChange(cleanVal);
                      if (cleanVal.length === 6 && !isLoading) {
                        otpForm.handleSubmit(onOTPSubmit)();
                      }
                    }}
                    disabled={isLoading}
                    pattern="^[0-9]+$"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    enterKeyHint="done"
                    ref={(el) => {
                      field.ref(el);
                      // @ts-ignore
                      otpInputRef.current = el;
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-11 h-12 text-lg rounded-l-xl" />
                      <InputOTPSlot index={1} className="w-11 h-12 text-lg" />
                      <InputOTPSlot index={2} className="w-11 h-12 text-lg rounded-r-xl sm:rounded-r-none" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="w-11 h-12 text-lg rounded-l-xl sm:rounded-l-none" />
                      <InputOTPSlot index={4} className="w-11 h-12 text-lg" />
                      <InputOTPSlot index={5} className="w-11 h-12 text-lg rounded-r-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                )}
              />
              {otpForm.formState.errors.otp && (
                <p className="text-xs font-semibold text-rose-500">
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1 font-medium">
                Verification code is valid for 5 minutes only.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 p-3.5 text-xs text-rose-800 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium leading-relaxed">{error}</div>
              </div>
            )}

            {/* Resend row */}
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-gray-400">Didn't receive it?</span>
              {countdown > 0 ? (
                <span className="text-gray-400 tabular-nums">
                  Resend OTP in{" "}
                  <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium text-xs">
                    {countdown}s
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm"
              disabled={isLoading || !otpForm.formState.isValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </Button>
          </form>
        ) : (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500 text-center">
            OTP entry is disabled because SMS delivery failed.
          </div>
        )}
      </div>
    );
  }

  return null;
}
