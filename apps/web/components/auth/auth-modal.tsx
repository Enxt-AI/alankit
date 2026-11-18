"use client";

import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { getSignupStatus } from "@/lib/auth-api";
import { OTPForm } from "./otp-form";
import { Phone, Mail, ArrowRight, AlertCircle } from "lucide-react";

type AuthStep = "phone-input" | "phone-otp" | "email-input" | "email-otp" | "name-input";

export function AuthModal() {
  const router = useRouter();
  const {
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    otpStep,
    setOTPStep,
    phoneOtpRequest,
    phoneOtpVerify,
    needsEmail,
    tempPhone,
    phoneOtpDeliveryMessage,
    phoneOtpSmsSent,
    phoneOtpDevFallbackAvailable,
    emailOtpRequest,
    emailOtpVerify,
    completeSignup,
    emailOtpStep,
    tempEmail,
    isAuthenticated,
  } = useAuthStore();

  const [fullName, setFullName] = useState("");
  const [nameError, setNameError] = useState("");
  const [currentStep, setCurrentStep] = useState<AuthStep>("phone-input");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const wasOpenRef = useRef(false);

  // Reset modal state when opening
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isAuthModalOpen;
    if (!isAuthModalOpen || wasOpen) return;
    setCurrentStep("phone-input");
    setPhoneNumber("");
    setPhoneError("");
    setEmail("");
    setEmailError("");
    setOtpValues(["", "", "", "", "", ""]);
    setOtpError("");
  }, [isAuthModalOpen]);

  // Close when authenticated
  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen && !needsEmail) {
      closeAuthModal();
    }
  }, [isAuthenticated, isAuthModalOpen, needsEmail, closeAuthModal]);

  // Sync with store states & check active OTP session on modal open
  useEffect(() => {
    if (!isAuthModalOpen) return;
    if (typeof window !== "undefined") {
      const activePhone = localStorage.getItem("unlistedstox_active_otp_phone");
      if (activePhone) {
        if (!phoneNumber) setPhoneNumber(activePhone);
        useAuthStore.getState().checkOtpStatus(activePhone).then((hasActive) => {
          if (hasActive) setCurrentStep("phone-otp");
        });
      }
    }
    if (otpStep === "otp") setCurrentStep("phone-otp");
  }, [isAuthModalOpen, otpStep]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    if (emailOtpStep === "name-input") setCurrentStep("name-input");
    else if (needsEmail) setCurrentStep((step) => step === "phone-input" || step === "phone-otp" ? "email-input" : step);
  }, [isAuthModalOpen, needsEmail, emailOtpStep]);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    let cancelled = false;
    getSignupStatus().then((pending) => {
      if (cancelled) return;
      if (pending.step === "phone") {
        useAuthStore.setState({ needsEmail: false, emailOtpStep: "idle", tempEmail: null });
        return;
      }
      useAuthStore.setState({ needsEmail: true, tempPhone: pending.phone || null,
        tempEmail: pending.email || null, emailOtpStep: pending.step === "name" ? "name-input" : "idle" });
      setPhoneNumber(pending.phone || "");
      setEmail(pending.email || "");
      setCurrentStep(pending.step === "name" ? "name-input" : "email-input");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthModalOpen]);

  const handleNameSubmit = async () => {
    const name = fullName.trim();
    if (name.length < 3 || name.length > 100 || !/^[a-zA-Z][a-zA-Z\s]*$/.test(name)) {
      setNameError("Enter 3–100 characters using letters and spaces.");
      return;
    }
    setIsSubmitting(true);
    setNameError("");
    try {
      await completeSignup({ fullName: name });
      closeAuthModal();
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Unable to complete signup");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Phone ──
  const handlePhoneSubmit = async () => {
    if (!phoneNumber.trim()) { setPhoneError("Please enter a phone number"); return; }
    try {
      setPhoneError("");
      setIsSubmitting(true);
      const result = await phoneOtpRequest(phoneNumber.trim());
      setCurrentStep("phone-otp");
      if (result.smsSent === false) {
        console.log(result.message || "OTP generated");
      } else {
        // toast removed
      }
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneOtpSuccess = () => {
    const { needsEmail: ne } = useAuthStore.getState();
    if (ne) {
      setCurrentStep("email-input");
    } else {
      closeAuthModal();
      router.push("/");
    }
  };

  // ── Email ──
  const handleEmailSubmit = async () => {
    if (!email.trim()) { setEmailError("Please enter your email"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError("Invalid email"); return; }
    try {
      setEmailError("");
      setIsSubmitting(true);
      await emailOtpRequest(email.trim(), undefined, tempPhone || undefined);
      setCurrentStep("email-otp");
      // toast removed
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Email OTP ──
  const handleOtpChange = (i: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    const nv = [...otpValues];
    nv[i] = value.slice(-1);
    setOtpValues(nv);
    setOtpError("");
    if (value && i < 5) otpInputRefs.current[i + 1]?.focus();
    if (value && i === 5 && nv.join("").length === 6) handleEmailOtpSubmit(nv.join(""));
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[i] && i > 0) otpInputRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (d.length === 6) { setOtpValues(d.split("")); otpInputRefs.current[5]?.focus(); handleEmailOtpSubmit(d); }
  };

  const handleEmailOtpSubmit = async (otp?: string) => {
    const code = otp || otpValues.join("");
    if (code.length !== 6) { setOtpError("Enter the 6-digit code"); return; }
    try {
      setOtpError("");
      setIsSubmitting(true);
      await emailOtpVerify(tempEmail || email, code, tempPhone || undefined);
      if (useAuthStore.getState().emailOtpStep === "name-input") setCurrentStep("name-input");
      else closeAuthModal();
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Invalid code");
      setOtpValues(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open: boolean) => (open ? openAuthModal() : closeAuthModal())}>
      <DialogContent className="w-[95vw] max-w-full sm:max-w-lg h-auto max-h-[90vh] sm:h-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === "phone-input" && "Welcome to SMC Unlisted Stocks"}
            {currentStep === "phone-otp" && "Verify Phone Number"}
            {currentStep === "email-input" && "Enter Email Address"}
            {currentStep === "email-otp" && "Verify Email"}
            {currentStep === "name-input" && "Complete Registration"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "phone-input" && "Sign in to explore exclusive unlisted stock investment opportunities"}
            {currentStep === "phone-otp" && "Enter the verification code sent to your phone"}
            {currentStep === "email-input" && "Verify your email to continue registration"}
            {currentStep === "email-otp" && `Enter the 6-digit code sent to ${tempEmail || email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {currentStep === "name-input" && (
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleNameSubmit(); }}>
              <Label htmlFor="signup-name">Full Name</Label>
              <Input id="signup-name" value={fullName} onChange={(event) => setFullName(event.target.value)}
                autoComplete="name" maxLength={100} required autoFocus />
              {nameError && <p role="alert" className="text-sm text-destructive">{nameError}</p>}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Completing registration..." : "Complete Registration"}
              </Button>
            </form>
          )}
          {/* Phone Input */}
          {currentStep === "phone-input" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="modal-phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <Input id="modal-phone" type="tel" placeholder="Enter your phone number"
                    value={phoneNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => { setPhoneNumber(e.target.value); if (phoneError) setPhoneError(""); }}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); handlePhoneSubmit(); } }}
                    className={cn(phoneError ? "border-destructive pl-10" : "pl-10")} />
                </div>
                {phoneError && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 p-3.5 text-xs text-rose-800 animate-in fade-in slide-in-from-top-1 duration-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <div className="flex-1 font-medium leading-relaxed">{phoneError}</div>
                  </div>
                )}
              </div>
              <Button onClick={handlePhoneSubmit} disabled={!phoneNumber.trim() || isSubmitting} className="w-full bg-[#0EA54F] hover:bg-[#0C8F44]">
                {isSubmitting ? "Sending..." : "Continue"}{!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </>
          )}

          {/* Phone OTP */}
          {currentStep === "phone-otp" && (
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
              devHint={phoneOtpSmsSent === false || phoneOtpDevFallbackAvailable ? phoneOtpDeliveryMessage || undefined : undefined}
            />
          )}

          {/* Email Input */}
          {currentStep === "email-input" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="modal-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  <Input id="modal-email" type="email" placeholder="you@example.com"
                    value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); handleEmailSubmit(); } }}
                    className={cn(emailError ? "border-destructive pl-10" : "pl-10")} />
                </div>
                {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              </div>
              <Button onClick={handleEmailSubmit} disabled={!email.trim() || isSubmitting} className="w-full bg-[#0EA54F] hover:bg-[#0C8F44]">
                {isSubmitting ? "Sending..." : "Verify Email"}{!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </>
          )}

          {/* Email OTP */}
          {currentStep === "email-otp" && (
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {otpValues.map((value, index) => (
                  <input key={index} ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={value}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className={cn("w-11 h-12 text-center text-xl font-bold border-2 rounded-lg bg-gray-50 focus:bg-white focus:border-[#0EA54F] focus:ring-2 focus:ring-[#0EA54F]/10 outline-none transition-all",
                      otpError ? "border-red-400" : value ? "border-[#0EA54F]" : "border-gray-200")}
                    autoFocus={index === 0} />
                ))}
              </div>
              {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
              <Button className="w-full bg-[#0EA54F] hover:bg-[#0C8F44]" onClick={() => handleEmailOtpSubmit()} disabled={isSubmitting || otpValues.join("").length !== 6}>
                {isSubmitting ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t get the code?{" "}
                <button onClick={async () => { try { setIsSubmitting(true); await emailOtpRequest(tempEmail || email, undefined, tempPhone || undefined); setOtpValues(["", "", "", "", "", ""]); } catch (e) { console.error(e); } finally { setIsSubmitting(false); } }}
                  disabled={isSubmitting} className="text-[#0EA54F] font-semibold hover:underline">Resend</button>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
