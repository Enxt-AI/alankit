"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  LockKeyhole,
  Mail,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";

import { authRequest, refreshSession } from "@/lib/auth";
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
    const returnUrl = new URLSearchParams(window.location.search).get("returnUrl");
    window.location.assign(returnUrl?.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/");
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
    step === "phone" ? "Welcome" :
    step === "phone-otp" ? "Verify Phone" :
    step === "email" ? "Enter Email" :
    step === "email-otp" ? "Verify Email" :
    step === "name" ? "Complete Profile" :
    "You're signed in";

  const stepDescription =
    step === "phone" ? "Enter your phone number to get started" :
    step === "phone-otp" ? `We've sent a 6-digit code to +91 ${phone}` :
    step === "email" ? "Link your email to complete sign-up" :
    step === "email-otp" ? `We've sent a 6-digit code to ${email}` :
    step === "name" ? "Please enter your full name to finish registration" :
    "Your account is ready.";

  return (
    <div className="flex min-h-screen bg-white font-sans">
      <aside className="relative hidden overflow-hidden border-r border-slate-100 bg-[#fafafa] p-6 lg:flex lg:w-[45%] lg:flex-col xl:w-[40%] xl:p-8 2xl:p-10">
        <div className="mx-auto flex h-full w-full max-w-lg flex-col justify-between">
          <Link href="/" className="flex w-fit items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#4F46E5] text-sm font-medium text-white">A</span>
            <span className="text-lg font-semibold text-zinc-900">Alankit</span>
          </Link>

          <div className="my-auto py-4">
            <h1 className="text-[30px] font-medium leading-[1.16] tracking-tight text-zinc-900 xl:text-[34px]">
              Invest in <br />
              <span className="text-[#4F46E5]">Pre-IPO &amp; Unlisted</span><br />
              Shares
            </h1>
            <p className="mb-6 mt-3 max-w-sm text-[13px] leading-relaxed text-zinc-500 xl:text-[14px]">
              Join investors accessing carefully selected pre-IPO and unlisted investment opportunities.
            </p>

            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="absolute size-40 rounded-full border-[24px] border-[#4F46E5]/10" />
              <div className="relative flex items-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-none">
                  <Zap className="size-8 text-[#4F46E5]" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4338CA]">Alankit</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">Investment access</p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-100/60 bg-white shadow-none">
                  <ShieldCheck className="size-5 text-[#4F46E5]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-medium leading-snug text-zinc-900">Institutional Grade Security</h3>
                  <p className="text-xs leading-normal text-zinc-500">Your investments and data are protected.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-100/60 bg-white shadow-none">
                  <Zap className="size-5 text-[#4F46E5]" />
                </div>
                <div>
                  <h3 className="text-[13px] font-medium leading-snug text-zinc-900">Lightning Fast Execution</h3>
                  <p className="text-xs leading-normal text-zinc-500">Experience seamless transaction processing.</p>
                </div>
              </div>
            </div>
          </div>
          <div />
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-1 flex-col justify-between bg-white p-4 sm:p-6 lg:p-8">
        <Link href="/" className="absolute right-6 top-6 hidden items-center gap-2 text-sm font-semibold text-[#4F46E5] transition-colors hover:text-[#4338CA] md:flex">
          <Home className="size-4" />Back to Home
        </Link>

        <div className="mx-auto flex flex-1 w-full max-w-[400px] flex-col justify-between py-2">
          <div className="my-auto w-full">
            <Link href="/" className="mb-5 flex items-center justify-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#4F46E5] text-xs font-medium text-white">A</span>
              <span className="font-semibold text-zinc-900">Alankit</span>
            </Link>

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
                      <div className={`h-1.5 rounded-full ${active ? "bg-[#4F46E5]" : complete ? "bg-indigo-200" : "bg-slate-100"}`} />
                      <p className={`mt-2 text-xs font-medium ${active ? "text-[#4338CA]" : complete ? "text-[#4F46E5]" : "text-zinc-500"}`}>{label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {step === "complete" ? (
              <div className="text-center sm:text-left">
                <span className="mx-auto flex size-12 items-center justify-center rounded-[16px] border border-indigo-100 bg-indigo-50 text-[#4F46E5] sm:mx-0">
                  <Check className="size-6" />
                </span>
                <p className="mt-5 text-sm font-semibold text-[#4F46E5]">You&apos;re signed in</p>
                <h1 className="mt-2 text-[24px] font-medium tracking-tight text-zinc-900 sm:text-[28px]">Welcome{name ? `, ${name}` : " back"}</h1>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 sm:text-[14px]">Your account is ready. Continue to your portfolio and orders.</p>
                <Link href="/dashboard" className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[17px] font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#4338CA]">
                  Continue to dashboard <ArrowRight className="size-[18px]" />
                </Link>
              </div>
            ) : (
              <>
                {step !== "phone-otp" && step !== "email-otp" && (
                  <div className="mb-4 space-y-2 text-center sm:text-left">
                    {step === "phone" && (
                      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[16px] border border-zinc-200 bg-indigo-50/50 sm:mx-0">
                        <User className="size-5 text-[#4F46E5]" strokeWidth={2.5} />
                      </span>
                    )}
                    <h1 className="text-[24px] font-medium tracking-tight text-zinc-900 sm:text-[28px]">{stepTitle}</h1>
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
                          className="h-14 w-full rounded-xl border border-zinc-200 bg-white pl-24 pr-4 text-[17px] text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                        />
                      </div>
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[17px] font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#4338CA]">
                      {busy ? "Sending code..." : "Continue"} <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {isOtpStep && (
                  <form onSubmit={step === "phone-otp" ? verifyPhone : verifyEmail} className="space-y-5">
                    <div className="space-y-1 text-center">
                      <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-indigo-50">
                        <ShieldCheck className="size-5 text-[#4F46E5]" />
                      </span>
                      <h1 className="text-xl font-medium text-slate-900">{step === "phone-otp" ? "Enter OTP" : "Verify Email"}</h1>
                      <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-zinc-500">
                        <span>We&apos;ve sent a 6-digit code to</span>
                        <span className="font-semibold text-slate-800">{step === "phone-otp" ? `+91 ${phone}` : email}</span>
                        {step === "phone-otp" && <button type="button" onClick={() => setStep("phone")} className="ml-1 text-xs font-semibold text-[#4F46E5] hover:underline">(Edit)</button>}
                        {step === "email-otp" && <button type="button" onClick={() => setStep("email")} className="ml-1 text-xs font-semibold text-[#4F46E5] hover:underline">(Edit)</button>}
                      </p>
                    </div>

                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
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
                          className="h-12 w-11 rounded-xl border border-slate-200 text-center text-lg font-medium text-slate-900 outline-none transition-all focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10 sm:w-12"
                        />
                      ))}
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[17px] font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#4338CA]">
                      {busy ? "Verifying..." : "Verify code"} <ArrowRight className="size-[18px]" />
                    </button>
                    <button type="button" disabled={busy || cooldown > 0} onClick={resendOtp} className="w-full text-sm text-[#4F46E5] disabled:text-zinc-400">
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
                        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setNotice(""); }} placeholder="you@example.com" className="h-14 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10" />
                      </div>
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[17px] font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#4338CA]">
                      {busy ? "Sending code..." : "Continue"} <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {step === "name" && (
                  <form onSubmit={completeRegistration} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="name" className="ml-1 text-sm font-semibold text-slate-700">Your Name</label>
                      <input id="name" name="name" type="text" autoComplete="name" required value={name} onChange={(event) => { setName(event.target.value); setNotice(""); }} placeholder="Enter your full name" className="h-14 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition-all focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10" />
                    </div>
                    <button aria-busy={busy} disabled={busy} type="submit" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] text-[17px] font-medium text-white shadow-none transition-all disabled:cursor-wait disabled:opacity-60 hover:bg-[#4338CA]">
                      Complete and sign in <ArrowRight className="size-[18px]" />
                    </button>
                  </form>
                )}

                {notice && (
                  <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-800">{notice}</p>
                )}

                {step === "phone" && (
                  <p className="mt-7 text-xs leading-relaxed text-zinc-500">
                    By continuing, you agree to our <Link href="/support" className="font-medium text-[#4F46E5] hover:text-[#4338CA]">Terms and Privacy Policy</Link>.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden items-center justify-center gap-2 text-xs text-zinc-500 lg:flex">
          <LockKeyhole className="size-3.5" />Secure sign-in experience
        </div>
      </main>
    </div>
  );
}
