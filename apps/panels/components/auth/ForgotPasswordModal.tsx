"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/floating-notification";
import { KeyRound, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import axios from "axios";
import { validatePassword } from "@/lib/password-policy";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<"EMAIL" | "VERIFY_OTP" | "RESET_PASSWORD" | "SUCCESS">("EMAIL");
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetFormState = () => {
    setStep("EMAIL");
    setOtp(["", "", "", "", "", ""]);
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
    setLoading(false);
  };

  const handleClose = () => {
    resetFormState();
    onClose();
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      notify.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/panel/forgot-password/send-otp", {
        email: email.trim(),
      });
      if (res.data?.success) {
        notify.success(res.data.message || "OTP sent to your email.");
        setStep("VERIFY_OTP");
        startResendCooldown();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to send OTP.";
      notify.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // OTP Box inputs handler
  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;

    const digits = pastedData.split("");
    const newOtp = ["", "", "", "", "", ""];
    digits.forEach((d, i) => {
      if (i < 6) newOtp[i] = d;
    });
    setOtp(newOtp);
    otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  // Step 2: Verify OTP only
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      notify.error("Please enter the complete 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await axios.post("/api/auth/panel/forgot-password/verify-otp", {
        email: email.trim(),
        otp: otpCode,
      });

      const token = verifyRes.data?.resetToken;
      if (!token) {
        throw new Error("Failed to obtain password reset verification token.");
      }
      setResetToken(token);
      notify.success("OTP verified successfully! Set your new password.");
      setStep("RESET_PASSWORD");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Invalid or expired OTP.";
      notify.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password using token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyResult = validatePassword(newPassword);
    if (!policyResult.isValid) {
      notify.error(policyResult.errorMessage || "Password does not meet security requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const resetRes = await axios.post("/api/auth/panel/forgot-password/reset-password", {
        email: email.trim(),
        resetToken,
        newPassword,
      });

      if (resetRes.data?.success) {
        notify.success("Password reset successfully! You can now log in.");
        setStep("SUCCESS");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to reset password.";
      notify.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
            {step === "SUCCESS" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : step === "RESET_PASSWORD" ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            ) : (
              <KeyRound className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
            {step === "EMAIL" && "Forgot Password"}
            {step === "VERIFY_OTP" && "Verify OTP"}
            {step === "RESET_PASSWORD" && "Set New Password"}
            {step === "SUCCESS" && "Password Reset Complete"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {step === "EMAIL" &&
              "Enter your registered panel email address. We will send a 6-digit verification code to reset your password."}
            {step === "VERIFY_OTP" &&
              `Enter the 6-digit OTP code sent to ${email}.`}
            {step === "RESET_PASSWORD" &&
              "OTP verified! Choose a new password for your account."}
            {step === "SUCCESS" &&
              "Your password has been updated successfully. Please log in with your new credentials."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Email */}
        {step === "EMAIL" && (
          <form onSubmit={handleSendOtp} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-xs border-slate-200 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="w-1/2 text-xs border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-1/2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "Send OTP"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP only */}
        {step === "VERIFY_OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-700">
                  Verification Code (OTP)
                </Label>
                {resendCooldown > 0 ? (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <div className="flex gap-2 justify-between">
                {otp.map((digit, idx) => (
                  <Input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="w-11 h-11 text-center font-mono font-bold text-base border-slate-200 focus-visible:ring-emerald-500"
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("EMAIL")}
                className="w-1/3 text-xs border-slate-200 text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-2/3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "Verify OTP"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Set New Password */}
        {step === "RESET_PASSWORD" && (
          <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 chars (Upper, Lower, Number, Special)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-9 text-xs border-slate-200 focus-visible:ring-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-9 text-xs border-slate-200 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("VERIFY_OTP")}
                className="w-1/3 text-xs border-slate-200 text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-2/3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "Save Password"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Success */}
        {step === "SUCCESS" && (
          <div className="pt-3 space-y-4">
            <Button
              onClick={handleClose}
              className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              Back to Login
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

