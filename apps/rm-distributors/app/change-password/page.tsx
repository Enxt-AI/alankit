"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

/** POST JSON to the auth-service (proxied via next.config rewrites) and normalise errors */
async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new Error(msg || "Something went wrong. Please try again.");
  }
  return data;
}

function ChangePasswordForm() {
  const searchParams = useSearchParams();
  const portalParam = searchParams.get("portal") || searchParams.get("type") || "distributor";
  const PORTALS = {
    branch: { back: "/login/branch", backLabel: "Back to Branch Login", title: "Branch Forgot Password" },
    distributor: { back: "/login/distributor", backLabel: "Back to Distributor Login", title: "Forgot Password" },
    "internal-rm": { back: "/login/rm", backLabel: "Back to RM Login", title: "SMC Branch RM Forgot Password" },
    "distributor-rm": { back: "/login/rm", backLabel: "Back to RM Login", title: "Distributor RM Forgot Password" },
  } as const;
  type PortalKey = keyof typeof PORTALS;
  const portalKey: PortalKey = portalParam in PORTALS ? (portalParam as PortalKey) : "distributor";
  const portalConfig = PORTALS[portalKey];

  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const backLink = portalConfig.back;
  const backLabel = portalConfig.backLabel;

  const normalizedEmail = () => email.trim().toLowerCase();

  const requestOtp = () =>
    postJson("/api/auth/partner/forgot-password/send-otp", {
      email: normalizedEmail(),
      portal: portalKey,
    });

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    try {
      await requestOtp();
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setError("");
    try {
      const data = await postJson("/api/auth/partner/forgot-password/verify-otp", {
        email: normalizedEmail(),
        portal: portalKey,
        otp: otp.trim(),
      });
      setResetToken(data.resetToken);
      setStep("password");
    } catch (err: any) {
      setError(err.message || "OTP is incorrect");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await requestOtp();
      setOtp("");
      alert("OTP has been resent to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await postJson("/api/auth/partner/forgot-password/reset-password", {
        email: normalizedEmail(),
        portal: portalKey,
        password: newPassword,
        resetToken,
      });
      alert("Password updated successfully! You can now log in.");
      window.location.href = withBasePath(backLink);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        <Link href={backLink} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6"/></svg>
          {backLabel}
        </Link>
        
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {step === "email" && portalConfig.title}
              {step === "otp" && "Enter OTP"}
              {step === "password" && "Reset Password"}
            </CardTitle>
            <CardDescription>
              {step === "email" && "Enter your registered email address to receive a verification OTP."}
              {step === "otp" && `We have sent a verification OTP to ${email}.`}
              {step === "password" && "Please choose a strong, secure password for your account (min. 8 characters)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input 
                    type="email" 
                    id="email" 
                    placeholder="name@example.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">One-Time Password (OTP)</Label>
                  <Input 
                    type="text" 
                    id="otp" 
                    placeholder="Enter 6-digit OTP" 
                    required 
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      if (error) setError("");
                    }}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
                <div className="text-center mt-4">
                  <button type="button" onClick={handleResendOtp} disabled={loading} className="text-sm text-primary hover:underline font-medium">
                    {loading ? "Resending..." : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    type="password" 
                    id="new-password" 
                    placeholder="Min. 8 characters" 
                    required 
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError("");
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must contain at least 8 characters, including uppercase, lowercase, number, and special character.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input 
                    type="password" 
                    id="confirm-password" 
                    placeholder="Repeat new password" 
                    required 
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError("");
                    }}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ChangePasswordForm />
    </Suspense>
  );
}
