"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, Phone } from "lucide-react";

const ACCOUNT_STORAGE_KEY = "alankit-prototype-accounts";
type PrototypeAccount = { phone: string; email: string; name: string };
type LoginStep = "phone" | "phone-otp" | "email" | "email-otp" | "name" | "complete";

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");

  function readAccounts(): PrototypeAccount[] {
    try {
      const saved = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (account): account is PrototypeAccount =>
          typeof account?.phone === "string" &&
          typeof account?.email === "string" &&
          typeof account?.name === "string",
      );
    } catch {
      return [];
    }
  }

  function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length !== 10) {
      setNotice("Enter a valid 10-digit mobile number.");
      return;
    }
    setPhone(normalizedPhone);
    setNotice("");
    setStep("phone-otp");
  }

  function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setNotice("Enter the 6-digit code to continue.");
      return;
    }
    const existingAccount = readAccounts().find((account) => account.phone === phone);
    if (existingAccount) {
      setName(existingAccount.name);
      setStep("complete");
    } else {
      setOtp("");
      setNotice("");
      setStep("email");
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setStep("email-otp");
  }

  function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setNotice("Enter the 6-digit code to continue.");
      return;
    }
    setOtp("");
    setNotice("");
    setStep("name");
  }

  function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = { phone, email, name: name.trim() };
    const accounts = readAccounts().filter((saved) => saved.phone !== phone);
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify([...accounts, account]));
    } catch {
      // Keep the UI flow usable when browser storage is unavailable.
    }
    setNotice("");
    setStep("complete");
  }

  const isOtpStep = step === "phone-otp" || step === "email-otp";
  const isNewAccount = step === "email" || step === "email-otp" || step === "name";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:min-h-[620px] lg:grid-cols-2">
          <section className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
            <Link href="/" className="mb-9 inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-700 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#4F46E5] text-xs font-bold text-white">A</span>Alankit
            </Link>

            {step !== "phone" && step !== "complete" && (
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  setOtp("");
                  setStep(step === "phone-otp" ? "phone" : step === "email" ? "phone-otp" : step === "email-otp" ? "email" : "email-otp");
                }}
                className="mb-6 inline-flex w-fit items-center gap-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              >
                <ArrowLeft className="size-4" />Back
              </button>
            )}

            {step === "complete" ? (
              <div>
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-6" /></span>
                <p className="mt-6 text-sm font-semibold text-[#4F46E5]">You’re signed in</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Welcome{name ? `, ${name}` : " back"}</h1>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">Your account is ready. Continue to your portfolio and orders.</p>
                <Link href="/dashboard" className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]">Continue to dashboard<ArrowRight className="size-4" /></Link>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#4F46E5]">{isNewAccount ? "Create your account" : "Welcome to Alankit"}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                  {step === "phone" && "Sign in or get started"}
                  {step === "phone-otp" && "Verify your number"}
                  {step === "email" && "Add your email"}
                  {step === "email-otp" && "Verify your email"}
                  {step === "name" && "What should we call you?"}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {step === "phone" && "Enter your mobile number to continue securely."}
                  {step === "phone-otp" && `Enter the code for +91 ${phone}.`}
                  {step === "email" && "We’ll use your email to finish setting up your account."}
                  {step === "email-otp" && `Enter the code for ${email}.`}
                  {step === "name" && "Add your name to complete your account setup."}
                </p>

                {isNewAccount && (
                  <div className="mt-6 flex items-center gap-2">
                    {["Phone", "Email", "Name"].map((label, index) => {
                      const current = step === "email" || step === "email-otp" ? 1 : step === "name" ? 2 : 0;
                      const complete = index < current;
                      const active = index === current;
                      return <div key={label} className={`rounded-full px-3 py-1 text-[11px] font-medium ${active ? "bg-indigo-50 text-[#4F46E5]" : complete ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-400"}`}>{label}</div>;
                    })}
                  </div>
                )}

                {step === "phone" && (
                  <form onSubmit={submitPhone} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="phone" className="mb-2 block text-sm font-medium text-zinc-700">Mobile number</label>
                      <div className="flex h-12 overflow-hidden rounded-lg border border-zinc-200 transition-colors focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-indigo-100">
                        <span className="inline-flex items-center gap-2 border-r border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600"><Phone className="size-4 text-zinc-400" />+91</span>
                        <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} required value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter 10-digit number" className="min-w-0 flex-1 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
                      </div>
                    </div>
                    <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]">Continue<ArrowRight className="size-4" /></button>
                  </form>
                )}

                {isOtpStep && (
                  <form onSubmit={step === "phone-otp" ? verifyPhone : verifyEmail} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="otp" className="mb-2 block text-sm font-medium text-zinc-700">6-digit verification code</label>
                      <input id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="h-12 w-full rounded-lg border border-zinc-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-zinc-900 outline-none transition-colors placeholder:text-zinc-300 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-100" />
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">UI preview only: no code is sent. Enter any 6 digits to continue.</p>
                    </div>
                    <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]">Verify code<ArrowRight className="size-4" /></button>
                  </form>
                )}

                {step === "email" && (
                  <form onSubmit={submitEmail} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700">Email address</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-100" />
                      </div>
                    </div>
                    <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]">Continue<ArrowRight className="size-4" /></button>
                  </form>
                )}

                {step === "name" && (
                  <form onSubmit={completeRegistration} className="mt-8 space-y-5">
                    <div>
                      <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-700">Your name</label>
                      <input id="name" name="name" type="text" autoComplete="name" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#4F46E5] focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]">Complete and sign in<ArrowRight className="size-4" /></button>
                  </form>
                )}

                {notice && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{notice}</p>}
                <p className="mt-7 text-xs leading-relaxed text-zinc-400">By continuing, you agree to our <Link href="/support" className="font-medium text-[#4F46E5] hover:text-[#4338CA]">Terms and Privacy Policy</Link>.</p>
              </>
            )}
          </section>

          <aside className="relative hidden overflow-hidden bg-[#111827] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative">
              <Link href="/" className="flex w-fit items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white">A</span>
                <span className="text-lg font-semibold tracking-tight">Alankit</span>
              </Link>
              <h2 className="mt-20 max-w-sm text-3xl font-medium leading-tight tracking-tight">Your investments, all in one place.</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-300">Sign in to follow your portfolio, order updates, and watchlist.</p>
            </div>
            <div className="relative flex items-center gap-2 text-xs text-zinc-400"><LockKeyhole className="size-3.5" />Secure sign-in experience</div>
          </aside>
        </div>
      </main>
    </div>
  );
}
