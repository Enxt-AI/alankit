"use client";

import {
  ShieldCheck,
  Headset,
  Megaphone,
  FileText,
  Receipt,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const panels = [
  {
    title: "Admin Console",
    description: "System configuration, user management, and platform oversight.",
    href: "/admin/login",
    icon: ShieldCheck,
  },
  {
    title: "Support Desk",
    description: "Ticket management, customer inquiries, and issue resolution.",
    href: "/support/login",
    icon: Headset,
  },
  {
    title: "Marketing Hub",
    description: "Campaign management, analytics, and content distribution.",
    href: "/marketing/login",
    icon: Megaphone,
  },
  {
    title: "Content Management",
    description: "Article posts, news updates, and static content control.",
    href: "/cms/login",
    icon: FileText,
  },
  {
    title: "Accounting Panel",
    description: "Manage finances, invoices, and payment tracking.",
    href: "/accounting/login",
    icon: Receipt,
  },
  {
    title: "Operation Panel",
    description: "Manage logistics, task workflows, and operational efficiency.",
    href: "/operation/login",
    icon: Settings,
  },
];

export default function PanelsLandingPage() {
  return (
    <div className="h-screen bg-white text-zinc-900 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="w-full max-w-[900px] px-6 py-4 flex flex-col justify-center">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[12px] uppercase tracking-wider text-gray-500 font-medium mb-3">
            SMC Internal Systems
          </p>
          <h1 className="text-4xl md:text-[44px] font-bold tracking-tight text-gray-900 mb-4 leading-tight">
            Select Your <span className="text-[#16a34a]">Workspace</span>
          </h1>
          <p className="text-[14px] text-gray-500">
            Access secure internal tools and management consoles. Authorized personnel only.
          </p>
        </div>

        {/* Grid */}
        <div className="group/grid grid grid-cols-1 md:grid-cols-3 gap-6">
          {panels.map((panel) => (
            <Link
              key={panel.href}
              href={panel.href}
              className="group block relative p-[28px] border border-gray-100 rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-150 ease-out outline-none hover:scale-[1.03] hover:z-10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:ring-2 hover:ring-zinc-900 group-hover/grid:blur-[1px] group-hover/grid:opacity-60 hover:!blur-none hover:!opacity-100"
            >
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-8">
                  {/* Icon Box */}
                  <div className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center border bg-[#f0fdf4] border-[#bbf7d0] text-green-600 transition-colors duration-150">
                    <panel.icon className="w-5 h-5 stroke-[2]" />
                  </div>
                  {/* Arrow inside a clean round shell */}
                  <div className="w-[28px] h-[28px] rounded-full bg-gray-50 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-zinc-900 group-hover:text-white shadow-sm transition-all duration-150">
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                <div className="mt-auto">
                  <h3 className="text-[15px] font-bold mb-1.5 text-gray-900 transition-colors">
                    {panel.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 leading-[1.6]">
                    {panel.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[12px] text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} SMC Unlisted Stox. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
