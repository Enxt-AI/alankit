"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Send,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const supportFaqs = [
  {
    id: "s1",
    q: "How are Indian unlisted shares credited to my Demat account?",
    a: "Once your order is confirmed and payment is verified, shares are transferred directly to your NSDL or CDSL Demat account within T+1 working days via off-market settlement.",
  },
  {
    id: "s2",
    q: "Can I use my existing NSDL or CDSL Demat account?",
    a: "Yes, you can link any active Indian Demat account (NSDL or CDSL) held with Alankit, Zerodha, Groww, HDFC Securities, ICICI Direct, or any SEBI-registered depository participant.",
  },
  {
    id: "s3",
    q: "What happens when an unlisted company files for an IPO?",
    a: "Your unlisted shares automatically convert into listed shares in your Demat account upon listing on NSE/BSE, subject to the standard SEBI pre-IPO lock-in period of 6 months from the allotment/listing date.",
  },
  {
    id: "s4",
    q: "What is the minimum lot size for buying unlisted stocks?",
    a: "Minimum lot sizes vary by company (typically between ₹10,000 and ₹50,000) and are displayed clearly on each stock's order ticket.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<string | null>("s1");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />

      <main className="flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <ScrollReveal variant="fade-up">
            <h1 className="text-3xl font-normal tracking-tight text-zinc-900 sm:text-[38px]">
              Investor Support &amp; Help Center
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-zinc-500">
              Need assistance with Indian unlisted stock settlements, Demat
              transfers, or KYC verification? Reach out to our desk below.
            </p>
          </ScrollReveal>

          {/* 3 Contact Cards */}
          <ScrollReveal variant="fade-up" delayMs={80}>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                  <Phone className="size-4" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-900">
                  Trading &amp; Settlement Desk
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  +91 11 4254 1234 / 1800-120-8492
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <Clock className="size-3" /> Mon – Sat, 9:00 AM – 6:30 PM IST
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                  <Mail className="size-4" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-900">
                  Email Support
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  support@alankit.in / unlisted@alankit.in
                </p>
                <p className="mt-2 text-[11px] text-[#4D9A78] font-medium">
                  Average response time: Under 2 hours
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200/80 bg-white p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                  <MapPin className="size-4" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-900">
                  Corporate Office
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Alankit House, 4E/2 Jhandewalan Extension, New Delhi - 110055
                </p>
                <p className="mt-2 text-[11px] text-zinc-400">
                  SEBI Registered DP (NSDL &amp; CDSL)
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* 2-Column Layout: Support Ticket Form + FAQs */}
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Contact Form */}
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-6 rounded-xl border border-zinc-200/80 bg-white p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-zinc-900">
                  Raise a Support Ticket
                </h2>
                {submitted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-[#4D9A78]">
                    <CheckCircle2 className="size-3.5" />
                    Ticket submitted
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Anshu Sharma"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Email or Client ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ALK-IN-84920"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-xs text-zinc-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Topic
                </label>
                <select className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:border-[#2563EB] focus:outline-none">
                  <option>Unlisted Share Order &amp; Settlement</option>
                  <option>Demat Account / DIS Verification</option>
                  <option>KYC &amp; Bank Account Update</option>
                  <option>Other Query</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your query or share your order reference number..."
                  className="w-full rounded-lg border border-zinc-200 bg-white p-3.5 text-xs text-zinc-900 focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                className="h-10 rounded-lg bg-[#2563EB] px-5 text-xs sm:text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                <Send className="mr-1.5 size-3.5" />
                Submit Request
              </Button>
            </form>

            {/* Right: Frequently Asked Questions */}
            <div className="lg:col-span-6">
              <h2 className="text-lg font-medium text-zinc-900">
                Frequently Asked Questions
              </h2>
              <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white">
                {supportFaqs.map((item) => {
                  const isOpen = openFaq === item.id;
                  return (
                    <div key={item.id} className="px-5">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : item.id)}
                        className="flex w-full items-center justify-between gap-4 py-4 text-left text-xs sm:text-sm font-medium text-zinc-900 hover:text-[#2563EB] cursor-pointer"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          className={`size-4 shrink-0 text-zinc-400 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <p className="pb-4 text-xs leading-relaxed text-zinc-600">
                          {item.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

