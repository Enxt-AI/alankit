"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/logo.png";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { authRequest, refreshSession } from "@/lib/auth";
import { getKycStatus, safeReturnUrl } from "@/lib/kyc";
type LoginStep = "phone" | "phone-otp" | "email" | "email-otp" | "name" | "complete";

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [notice, setNotice] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    let active = true;
    void authRequest("signup/status").then((pending) => {
      if (!active) return;
      if (pending.phone) setPhone(pending.phone);
      if (pending.email) setEmail(pending.email);
      if (pending.step === "name" || pending.step === "email") setStep(pending.step);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function finishLogin() {
    if (!await refreshSession()) throw new Error("Unable to confirm your session. Please sign in again.");
    const returnUrl = safeReturnUrl(new URLSearchParams(window.location.search).get("returnUrl"), '/');
    const kyc = await getKycStatus();
    window.location.assign(kyc.kycStatus === 'VERIFIED' || returnUrl.startsWith('/kyc')
      ? returnUrl : `/kyc?returnUrl=${encodeURIComponent(returnUrl)}`);
  }
  function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!/^[6-9]\d{9}$/.test(phone) || /^(\d)\1{9}$/.test(phone)) throw new Error("Enter a valid 10-digit Indian mobile number.");
      const result = await authRequest("phone/otp/request", { phone });
      setOtp(["", "", "", "", "", ""]); setStep("phone-otp");
      setCooldown(result.cooldownRemainingSeconds || 60);
      if (result.smsSent === false) setNotice(result.message || "SMS delivery is unavailable. Please try again.");
    });
  }
  function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!/^\d{6}$/.test(otp.join(""))) throw new Error("Enter the 6-digit code.");
      const result = await authRequest("phone/otp/verify", { phone, otp: otp.join("") });
      if (result.needsEmail) { setOtp(["", "", "", "", "", ""]); setStep("email"); }
      else await finishLogin();
    });
  }
  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      await authRequest("email/otp/request", { email: email.trim(), phone });
      setEmail(email.trim()); setOtp(["", "", "", "", "", ""]); setStep("email-otp"); setCooldown(60);
    });
  }
  function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!/^\d{6}$/.test(otp.join(""))) throw new Error("Enter the 6-digit code.");
      const result = await authRequest("email/otp/verify", { email, phone, otp: otp.join("") });
      if (result.needsName) setStep("name"); else await finishLogin();
    });
  }
  function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!/^[a-zA-Z][a-zA-Z\s]{2,99}$/.test(name.trim())) throw new Error("Enter your full name using 3-100 letters and spaces.");
      await authRequest("signup/complete", { fullName: name.trim() });
      await finishLogin();
    });
  }
  function resendOtp() {
    void run(async () => {
      const result = await authRequest(step === "phone-otp" ? "phone/otp/request" : "email/otp/request", step === "phone-otp" ? { phone } : { email, phone });
      setCooldown(result.cooldownRemainingSeconds || 60); setOtp(["", "", "", "", "", ""]);
      setNotice(result.message || "A new code has been requested.");
    });
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    setOtp((current) => current.map((_, index) => digits[index] || ""));
    otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
  }

  function goBack() {
    setNotice("");
    setOtp(["", "", "", "", "", ""]);
    if (step === "phone-otp") setStep("phone");
    if (step === "email") setStep("phone-otp");
    if (step === "email-otp") setStep("email");
    if (step === "name") setStep("email-otp");
  }

  const isOtpStep = step === "phone-otp" || step === "email-otp";
  const isNewAccount = step === "email" || step === "email-otp" || step === "name";
  const stepTitle =
    step === "phone" ? "Welcome to Alankit" :
    step === "phone-otp" ? "Verify Phone" :
    step === "email" ? "Enter Email" :
    step === "email-otp" ? "Verify Email" :
    step === "name" ? "Complete Profile" :
    "You're signed in";

  const stepDescription =
    step === "phone" ? "Sign in or create an account with your mobile number." :
    step === "phone-otp" ? `We've sent a 6-digit code to +91 ${phone}` :
    step === "email" ? "Link your email to complete sign-up" :
    step === "email-otp" ? `We've sent a 6-digit code to ${email}` :
    step === "name" ? "Please enter your full name to finish registration" :
    "Your account is ready.";

  return (
    <div className="flex min-h-svh flex-col bg-white font-sans text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link href="/" aria-label="UnlistedStocx home" className="flex items-center gap-2.5">
            <Image src={logo} alt="UnlistedStocx" className="h-auto w-40 sm:w-48" preload />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            <ArrowLeft className="size-4" />Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-14 sm:py-20">
        <div className="w-full max-w-[380px]">
          <div className="w-full">
            {step !== "phone" && step !== "complete" && (
              <button type="button" onClick={goBack} className="mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-slate-700">
                <ArrowLeft className="size-4" />Back
              </button>
            )}

            {isNewAccount && (
              <div className="mb-5 flex items-center gap-2">
                {["Phone", "Email", "Name"].map((label, index) => {
                  const current = step === "email" || step === "email-otp" ? 1 : step === "name" ? 2 : 0;
                  const complete = index < current;
                  const active = index === current;
                  return (
                    <div key={label} className={`flex-1`}>
                      <div className={`h-1.5 rounded-full ${active ? "bg-[#2563EB]" : complete ? "bg-blue-200" : "bg-slate-100"}`} />
                      <p className={`mt-2 text-xs font-medium ${active ? "text-[#1D4ED8]" : complete ? "text-[#2563EB]" : "text-zinc-500"}`}>{label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {step === "complete" ? (
              <div className="text-center sm:text-left">
                <span className="mx-auto flex size-12 items-center justify-center rounded-[16px] border border-blue-100 bg-blue-50 text-[#2563EB] sm:mx-0">
                  <Check className="size-6" />
                </span>
                <p className="mt-5 text-sm font-semibold text-[#2563EB]">You&apos;re signed in</p>
                <h1 className="mt-2 text-[28px] font-normal tracking-tight text-zinc-900 sm:text-[32px]">Welcome{name ? `, ${name}` : " back"}</h1>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">Your account is ready. Continue to your portfolio and orders.</p>
                <Link href="/dashboard" className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#1D4ED8]">
                  Continue to dashboard <ArrowRight className="size-[18px]" />
                </Link>
              </div>
            ) : (
              <>
                {step !== "phone-otp" && step !== "email-otp" && (
                  <div className="mb-8 space-y-3 text-left">
                    {step === "phone" && (
                      <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[#2563EB]">Your investment journey</p>
                    )}
                    <h1 className="text-[28px] font-normal tracking-tight text-zinc-900 sm:text-[32px]">{stepTitle}</h1>
                    <p className="text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">{stepDescription}</p>
                  </div>
                )}

                {step === "phone" && (
                  <form onSubmit={submitPhone} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="phone" className="ml-1 text-[13px] font-medium text-slate-700">Phone Number</label>
                      <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-4 flex items-center text-[15px] font-semibold text-slate-700">+91 <span className="mx-2 h-5 w-px bg-slate-200" /></span>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={10}
                          required
                          autoFocus
                          value={phone}
                          onChange={(event) => {
                            setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                            setNotice("");
                          }}
                          placeholder="98765 43210"
                          className="h-12 w-full rounded-lg border border-zinc-200 bg-white pl-24 pr-4 text-base text-slate-800 shadow-none outline-none transition-all placeholder:text-slate-300 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                        />
                      </div>
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#1D4ED8]">
                      {busy ? "Sending code..." : "Continue"} <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {isOtpStep && (
                  <form onSubmit={step === "phone-otp" ? verifyPhone : verifyEmail} className="space-y-5">
                    <div className="space-y-1 text-center">
                      <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-blue-50">
                        <ShieldCheck className="size-5 text-[#2563EB]" />
                      </span>
                      <h1 className="text-xl font-medium text-slate-900">{step === "phone-otp" ? "Enter OTP" : "Verify Email"}</h1>
                      <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-zinc-500">
                        <span>We&apos;ve sent a 6-digit code to</span>
                        <span className="font-semibold text-slate-800">{step === "phone-otp" ? `+91 ${phone}` : email}</span>
                        {step === "phone-otp" && <button type="button" onClick={() => setStep("phone")} className="ml-1 text-xs font-semibold text-[#2563EB] hover:underline">(Edit)</button>}
                        {step === "email-otp" && <button type="button" onClick={() => setStep("email")} className="ml-1 text-xs font-semibold text-[#2563EB] hover:underline">(Edit)</button>}
                      </p>
                    </div>

                    <div className="grid grid-cols-6 gap-2" onPaste={handleOtpPaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => { otpRefs.current[index] = element; }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          maxLength={1}
                          value={digit}
                          onChange={(event) => updateOtp(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          aria-label={`OTP digit ${index + 1}`}
                          className="h-12 min-w-0 w-full rounded-lg border border-slate-200 text-center text-lg font-medium text-slate-900 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
                        />
                      ))}
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#1D4ED8]">
                      {busy ? "Verifying..." : "Verify code"} <ArrowRight className="size-[18px]" />
                    </button>
                    <button type="button" disabled={busy || cooldown > 0} onClick={resendOtp} className="w-full text-sm text-[#2563EB] disabled:text-zinc-400">
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                  </form>
                )}

                {step === "email" && (
                  <form onSubmit={submitEmail} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email" className="ml-1 text-sm font-semibold text-slate-700">Email Address</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setNotice(""); }} placeholder="you@example.com" className="h-12 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10" />
                      </div>
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#1D4ED8]">
                      {busy ? "Sending code..." : "Continue"} <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {step === "name" && (
                  <form onSubmit={completeRegistration} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="name" className="ml-1 text-sm font-semibold text-slate-700">Your Name</label>
                      <input id="name" name="name" type="text" autoComplete="name" required value={name} onChange={(event) => { setName(event.target.value); setNotice(""); }} placeholder="Enter your full name" className="h-12 w-full rounded-lg border border-slate-200 px-4 text-sm text-slate-900 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10" />
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#1D4ED8]">
                      Complete and sign in <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {notice && (
                  <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-800">{notice}</p>
                )}

                {step === "phone" && (
                  <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
                    By continuing, you agree to our <Link href="/support" className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">Terms and Privacy Policy</Link>.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

      </main>
      <footer className="mx-6 border-t border-zinc-100 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-zinc-500 sm:justify-between lg:px-4">
          <span className="inline-flex items-center gap-2"><LockKeyhole className="size-3.5" />Sign in securely with a one-time code</span>
          <Link href="/support" className="transition-colors hover:text-[#2563EB]">Need help? Contact support</Link>
        </div>
      </footer>
    </div>
  );
}
