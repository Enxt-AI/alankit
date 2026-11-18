"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  BarChart2,
  Bookmark,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Bell,
  Search,
  ChevronRight,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Building2,
  FileCheck2,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const mainMenuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid, href: "/dashboard" },
  { id: "portfolio", label: "Portfolio", icon: BarChart2, href: "/dashboard" },
  { id: "watchlist", label: "Watchlist", icon: Bookmark, href: "/dashboard" },
  { id: "orders", label: "Orders", icon: ClipboardList, href: "/dashboard" },
] as const;

const kycDetailRows = [
  { label: "PAN Number", value: "ABCDE1234F", badge: "Verified", copyable: true },
  { label: "Aadhaar (Masked)", value: "XXXX-XXXX-0000" },
  { label: "CKYC Number", value: "00001234567890", copyable: true },
  { label: "Date of Birth", value: "DD MMM YYYY" },
  { label: "KRA Agency", value: "CVL KRA Validated" },
  { label: "Nominee", value: "Nominee Name (100%)" },
  { label: "Tax Residency", value: "India (FATCA Declared)" },
];

const dematAccounts = [
  {
    id: "nsdl",
    tabLabel: "NSDL (Primary)",
    depository: "NSDL",
    dpName: "Depository Participant Name",
    dpId: "IN300000",
    clientId: "00000000",
    boId: "IN30000000000000",
    accountSubType: "Resident Individual (Non-PBA)",
    cmrStatus: "Digitally Signed & Verified",
    settlementMode: "Active for Unlisted & Pre-IPO Credit",
    linkedPan: "ABCDE1234F",
    openedDate: "01 Jan 2024",
    isPrimary: true,
  },
  {
    id: "cdsl",
    tabLabel: "CDSL (Secondary)",
    depository: "CDSL",
    dpName: "Secondary Broker Limited",
    dpId: "12000000",
    clientId: "00000000",
    boId: "1200000000000000",
    accountSubType: "Resident Individual",
    cmrStatus: "Verified",
    settlementMode: "Secondary Demat Account",
    linkedPan: "ABCDE1234F",
    openedDate: "15 Jun 2024",
    isPrimary: false,
  },
];

const bankAccounts = [
  {
    id: "hdfc",
    bankName: "Primary Bank Name",
    shortCode: "BANK",
    branch: "Branch Name, City",
    accountHolder: "INVESTOR FULL NAME",
    accountNumber: "00001234567890",
    ifsc: "BANK0000001",
    micr: "000000001",
    accountType: "Savings Account",
    upiId: "username@bank",
    status: "Primary Payout Bank",
    verifiedVia: "Penny-Drop & Cancelled Cheque",
    isPrimary: true,
  },
  {
    id: "icici",
    bankName: "Secondary Bank Name",
    shortCode: "BANK",
    branch: "Branch Name, City",
    accountHolder: "INVESTOR FULL NAME",
    accountNumber: "00009876543210",
    ifsc: "BANK0000002",
    micr: "000000002",
    accountType: "Savings Account",
    upiId: "username@upi",
    status: "Secondary Bank",
    verifiedVia: "Penny-Drop Verified",
    isPrimary: false,
  },
];

const verifiedDocs = [
  {
    id: "doc-pan",
    title: "PAN Card Copy",
    subtitle: "ABCDE1234F • Self-Attested",
    date: "01 Jan 2026",
    status: "Approved",
  },
  {
    id: "doc-cmr",
    title: "NSDL CMR Copy",
    subtitle: "DP ID: IN300000-00000000",
    date: "01 Jan 2026",
    status: "Approved",
  },
  {
    id: "doc-cheque",
    title: "Cancelled Cheque",
    subtitle: "Primary Bank •••• 7890",
    date: "01 Jan 2026",
    status: "Approved",
  },
  {
    id: "doc-aadhaar",
    title: "Aadhaar e-KYC",
    subtitle: "DigiLocker XML •••• 0000",
    date: "01 Jan 2026",
    status: "Approved",
  },
];

export default function ProfilePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDematId, setSelectedDematId] = useState<string>("nsdl");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const activeDemat =
    dematAccounts.find((d) => d.id === selectedDematId) || dematAccounts[0];

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-white font-sans text-zinc-900">
      {/* Full-width App Shell matching Dashboard */}
      <div className="flex h-screen w-full overflow-hidden bg-white">
        {/* ================= FIXED LEFT SIDEBAR (Same as Dashboard) ================= */}
        <aside
          className={`sticky top-0 flex h-screen flex-col justify-between border-r border-zinc-100 bg-white transition-all duration-200 shrink-0 select-none ${
            sidebarCollapsed ? "w-[76px]" : "w-60 xl:w-64"
          }`}
        >
          <div className="p-4">
            {/* Top Brand Row */}
            <div className="flex items-center justify-between px-1 py-1">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-zinc-200 text-[#4F46E5]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 400 400"
                    fill="none"
                    aria-hidden="true"
                  >
                    <g
                      stroke="currentColor"
                      strokeWidth="42"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="72"
                        y="72"
                        width="128"
                        height="128"
                        rx="48"
                        transform="rotate(-45 136 136)"
                      />
                      <rect
                        x="200"
                        y="72"
                        width="128"
                        height="128"
                        rx="48"
                        transform="rotate(45 264 136)"
                      />
                      <rect
                        x="72"
                        y="200"
                        width="128"
                        height="128"
                        rx="48"
                        transform="rotate(45 136 264)"
                      />
                      <rect
                        x="200"
                        y="200"
                        width="128"
                        height="128"
                        rx="48"
                        transform="rotate(-45 264 264)"
                      />
                    </g>
                  </svg>
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[15px] font-semibold tracking-tight text-zinc-800">
                    Alankit
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((p) => !p)}
                aria-label="Toggle sidebar"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </button>
            </div>

            {/* MAIN Navigation Group */}
            <div className="mt-6">
              {!sidebarCollapsed && (
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  MAIN
                </p>
              )}
              <nav className="mt-2 space-y-1">
                {mainMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      <Icon className="size-4 shrink-0 text-zinc-400" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom User Profile Pill (Active on Profile Page) */}
          <div className="border-t border-zinc-100 p-4">
            <Link
              href="/profile"
              className="flex items-center justify-between gap-2.5 rounded-xl bg-[#F1F5F9] p-2 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E2433] text-xs font-semibold text-white">
                  JD
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900">
                      John Doe
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      investor@example.com
                    </p>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <ChevronRight className="size-4 shrink-0 text-zinc-600" />
              )}
            </Link>
          </div>
        </aside>

        {/* ================= MAIN WORKSPACE AREA (Scrollable) ================= */}
        <div className="flex h-screen flex-1 flex-col min-w-0 overflow-y-auto">
          {/* Top Bar: Breadcrumb on Left + Bell & Search (⌘K) on Right */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-white/95 px-6 py-3.5 backdrop-blur-xs">
            {/* Working Shadcn Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/" />}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href="/dashboard" />}>
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Investor Profile &amp; KYC</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Notifications"
                className="flex size-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 cursor-pointer"
              >
                <Bell className="size-4" />
              </button>

              <div className="relative hidden sm:block w-52 lg:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search.."
                  className="h-9 w-full rounded-lg border border-zinc-200/80 bg-[#F8FAFC] pl-8 pr-12 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  ⌘K
                </kbd>
              </div>
            </div>
          </header>

          {/* Main 2-Column Content Grid matching Dashboard Aesthetic */}
          <div className="grid flex-1 grid-cols-1 lg:grid-cols-12">
            {/* ======== LEFT COLUMN: User Overview, Detail KYC, Compliance Card & Account Summary ======== */}
            <div className="border-b border-zinc-100 p-6 lg:col-span-4 lg:border-b-0 lg:border-r">
              {/* Investor Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#1E2433] text-sm font-bold text-white">
                    JD
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-semibold text-zinc-900 leading-tight">
                        John Doe
                      </h1>
                      <CheckCircle2 className="size-4 text-[#22C55E]" />
                    </div>
                    <p className="text-xs text-zinc-400">
                      Resident Individual (Investor)
                    </p>
                  </div>
                </div>

                <span className="rounded-lg border border-zinc-200/80 bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  ID-00000
                </span>
              </div>

              {/* Primary Contact + Status */}
              <div className="mt-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-zinc-900">
                    IN300000-00000000
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    ▲ NSDL Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Contact{" "}
                  <span className="font-medium text-zinc-700">
                    +91 98765 43210
                  </span>{" "}
                  •{" "}
                  <span className="font-medium text-zinc-700">
                    investor@example.com
                  </span>
                </p>
              </div>

              {/* Action Buttons (Styled identically to Dashboard Sell / Buy buttons) */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleCopy("top-bo", "IN30000000000000")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#F1F5F9] text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-200/70 cursor-pointer"
                >
                  {copiedKey === "top-bo" ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      Copied Demat ID
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 text-zinc-500" />
                      Copy Demat ID
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1E2433] text-xs font-semibold text-white transition-colors hover:bg-zinc-800 cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Download CMR
                </button>
              </div>

              {/* Detail KYC Identity (Matches "Detail Product" list style in Dashboard) */}
              <div className="mt-7">
                <h2 className="text-sm font-semibold text-zinc-900">
                  KYC Identity Details
                </h2>
                <div className="mt-3 divide-y divide-zinc-100 text-xs">
                  {kycDetailRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-zinc-500">{row.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-900">
                          {row.value}
                        </span>
                        {row.badge && (
                          <span className="text-[11px] font-medium text-emerald-600">
                            ✓ {row.badge}
                          </span>
                        )}
                        {row.copyable && (
                          <button
                            type="button"
                            onClick={() => handleCopy(row.label, row.value)}
                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                            title={`Copy ${row.label}`}
                          >
                            {copiedKey === row.label ? (
                              <Check className="size-3 text-emerald-600" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ======== RIGHT COLUMN: Demat Account Data, Bank Account Info & Verified Documents ======== */}
            <div className="flex flex-col justify-between p-6 lg:col-span-8">
              <div className="space-y-7">
                {/* 1. DEMAT ACCOUNT DATA SECTION */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-zinc-800" />
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Demat Account Data
                      </h2>
                    </div>

                    {/* Depository Switcher Pills (Matches Price / Market Cap toggle in Dashboard) */}
                    <div className="inline-flex rounded-xl bg-zinc-100 p-1">
                      {dematAccounts.map((dm) => (
                        <button
                          key={dm.id}
                          type="button"
                          onClick={() => setSelectedDematId(dm.id)}
                          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            selectedDematId === dm.id
                              ? "bg-white text-zinc-900 shadow-2xs"
                              : "text-zinc-500 hover:text-zinc-900"
                          }`}
                        >
                          {dm.tabLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Demat Card */}
                  <div className="mt-4 rounded-xl border border-zinc-200/80 bg-[#F8FAFC]/50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-[#1E2433] text-xs font-bold text-white">
                          {activeDemat.depository}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900">
                            {activeDemat.dpName}
                          </h3>
                          <p className="text-xs text-zinc-400">
                            {activeDemat.accountSubType} • Opened{" "}
                            {activeDemat.openedDate}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                        ✓ {activeDemat.cmrStatus}
                      </span>
                    </div>

                    {/* 3-Column Demat Numbers */}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-100 bg-white p-3.5">
                        <span className="text-[11px] text-zinc-400">
                          DP ID (Depository Participant)
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-900">
                            {activeDemat.dpId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy("dpid", activeDemat.dpId)
                            }
                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                          >
                            {copiedKey === "dpid" ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-100 bg-white p-3.5">
                        <span className="text-[11px] text-zinc-400">
                          Client ID / Beneficiary ID
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm font-bold text-zinc-900">
                            {activeDemat.clientId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy("clientid", activeDemat.clientId)
                            }
                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                          >
                            {copiedKey === "clientid" ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-100 bg-white p-3.5">
                        <span className="text-[11px] text-zinc-400">
                          Full 16-Digit Demat BO ID
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-600">
                            {activeDemat.boId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy("fullbo", activeDemat.boId)
                            }
                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                          >
                            {copiedKey === "fullbo" ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>
                        Settlement Eligibility:{" "}
                        <strong className="font-semibold text-zinc-800">
                          {activeDemat.settlementMode}
                        </strong>
                      </span>
                      <span>
                        Linked PAN:{" "}
                        <strong className="font-semibold text-zinc-800">
                          {activeDemat.linkedPan}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. BANK ACCOUNT INFORMATION SECTION */}
                <div className="border-t border-zinc-100 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-zinc-800" />
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Linked Bank Account Information
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1E2433] px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      Add Bank Account
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {bankAccounts.map((bank) => (
                      <div
                        key={bank.id}
                        className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs"
                      >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-[#F8FAFC] border border-zinc-200/70 text-zinc-800">
                              <CreditCard className="size-4" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-zinc-900">
                                {bank.bankName}
                              </h3>
                              <p className="text-[11px] text-zinc-400">
                                {bank.branch}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              bank.isPrimary
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {bank.status}
                          </span>
                        </div>

                        <div className="mt-3 divide-y divide-zinc-100 text-xs">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-zinc-400">Account Holder</span>
                            <span className="font-semibold text-zinc-900">
                              {bank.accountHolder}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-zinc-400">Account Number</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-900">
                                {bank.accountNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(bank.id, bank.accountNumber)
                                }
                                className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                              >
                                {copiedKey === bank.id ? (
                                  <Check className="size-3 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-zinc-400">
                              IFSC &amp; MICR Code
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {bank.ifsc} • {bank.micr}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-zinc-400">
                              Type &amp; UPI ID
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {bank.accountType} ({bank.upiId})
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-zinc-400">Verification</span>
                            <span className="font-semibold text-emerald-600">
                              ✓ {bank.verifiedVia}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. BOTTOM 4-CARD DOCUMENT GRID (Matches "You May Also Like" 4-card grid in Dashboard) */}
              <div className="mt-8 border-t border-zinc-100 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="size-4 text-zinc-800" />
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Verified KYC &amp; Demat Documents
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">
                    All 4 Documents Approved
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                  {verifiedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-white p-3.5 transition-all hover:border-zinc-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <CheckCircle2 className="size-4" />
                        </span>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ▲ {doc.status}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-bold text-zinc-900">
                          {doc.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                          {doc.subtitle}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
                        <span>{doc.date}</span>
                        <button
                          type="button"
                          className="font-semibold text-zinc-700 hover:text-zinc-900 cursor-pointer"
                        >
                          PDF ↗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
