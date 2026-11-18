import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal & Policies",
  description:
    "Review UnlistedStox's legal documents, Terms & Conditions, Privacy Policy, Disclaimer, and other important compliance information.",
};
import Link from "next/link";
import {
  HiDocumentText,
  HiShieldCheck,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { BiCookie, BiBlock, BiMoneyWithdraw } from "react-icons/bi";
import { IconType } from "react-icons";

type PolicyItem = {
  title: string;
  description: string;
  updated: string;
  iconBg: string;
  iconColor: string;
  linkColor: string;
  icon: IconType;
  href: string;
};

const policies: PolicyItem[] = [
  {
    title: "Terms & Conditions",
    description:
      "Our terms of service outline the rules and regulations for using our platform and services.",
    updated: "Updated 2024",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    linkColor: "text-blue-600",
    icon: HiDocumentText,
    href: "/legal-policies/terms-and-conditions",
  },
  {
    title: "Privacy Policy",
    description:
      "Learn how we collect, use, protect, and share your personal information and data.",
    updated: "Updated 2024",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    linkColor: "text-purple-600",
    icon: HiShieldCheck,
    href: "/legal-policies/privacy-policy",
  },
  {
    title: "Disclaimer",
    description:
      "Important information about limitations of liability and disclaimers of warranties.",
    updated: "Updated 2024",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    linkColor: "text-orange-600",
    icon: HiExclamationTriangle,
    href: "/legal-policies/disclaimer",
  },
  {
    title: "Cookie Policy",
    description:
      "Information about how we use cookies and similar tracking technologies on our platform.",
    updated: "Updated 2024",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    linkColor: "text-green-600",
    icon: BiCookie,
    href: "/legal-policies/cookie-policy",
  },
  {
    title: "Acceptable Use",
    description:
      "Guidelines for acceptable and prohibited uses of our services and platform.",
    updated: "Updated 2024",
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    linkColor: "text-red-600",
    icon: BiBlock,
    href: "/legal-policies/acceptable-use",
  },
  {
    title: "Refund Policy",
    description:
      "Our policy regarding refunds, cancellations, and money-back guarantees.",
    updated: "Updated 2024",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    linkColor: "text-indigo-600",
    icon: BiMoneyWithdraw,
    href: "/legal-policies/refund-policy",
  },
];

export default function LegalPolicies() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14">
        {/* Top Badge */}
        <div className="flex justify-center">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            Legal Information
          </span>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Legal &amp; Policies
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Review our legal documents, terms of service, and policies to
            understand how we protect and serve you.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="relative block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer no-underline"
              >
                {/* Updated pill */}
                <span className="absolute right-5 top-5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                  {item.updated}
                </span>

                {/* Icon */}
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-xl ${item.iconBg}`}
                >
                  <Icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>

                {/* Text */}
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>

                {/* Link label */}
                <span
                  className={`mt-5 inline-flex items-center gap-2 text-sm font-medium ${item.linkColor}`}
                >
                  Read Full Document
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
