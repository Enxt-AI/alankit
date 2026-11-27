"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Headphones,
  Settings,
  CheckCircle,
  TicketPercent,
} from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminSidebarProps {
  className?: string;
  onLinkClick?: () => void;
  collapsed?: boolean;
}

const navLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/promotions", label: "Promotions", icon: TicketPercent },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/panel-users", label: "Panel User Management", icon: Users },
  { href: "/admin/distributors", label: "Distributors", icon: Users },
  { href: "/admin/branches", label: " Branches", icon: Users },
  { href: "/admin/esign-templates", label: "e-Sign Templates", icon: Settings },
  { href: "/admin/approvals", label: "Approvals", icon: CheckCircle },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
];

export default function AdminSidebar({
  className,
  onLinkClick,
  collapsed = false,
}: AdminSidebarProps) {
  const { admin } = useAuthStore();
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="Admin navigation"
        className={cn(
          "flex h-screen flex-col bg-white border-r border-neutral-200/30 py-2 transition-all duration-300",
          className,
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "pt-6 pb-5 transition-all duration-300",
            collapsed ? "px-2 text-center" : "px-7",
          )}
        >
          {collapsed ? (
            <span className="text-[18px] font-black text-[#16A34A] tracking-tight"></span>
          ) : (
            <h1 className="text-[20px] font-extrabold tracking-tight leading-none text-[#0F172A] whitespace-nowrap">
              <span className="text-[#16A34A]"></span> Admin
            </h1>
          )}
        </div>

        {/* Navigation Section */}
        <div
          className={cn(
            "flex-1 overflow-y-auto pt-3 transition-all duration-300",
            collapsed ? "px-2" : "px-4",
          )}
        >
          {!collapsed && (
            <p className="px-4 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#64748B]/60">
              Menu
            </p>
          )}
          <ul className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);

              const linkContent = (
                <Link
                  href={link.href}
                  onClick={onLinkClick}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav flex items-center transition-all duration-300 ease-in-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2",
                    collapsed
                      ? "justify-center p-2.5 rounded-xl"
                      : "gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold",
                    active
                      ? "bg-[#DCFCE7]/70 text-[#16A34A]"
                      : "text-[#64748B] bg-transparent hover:bg-[#ECFDF5] hover:text-[#0F172A]",
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-colors duration-300 ease-in-out shrink-0",
                      collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                      active
                        ? "text-[#16A34A]"
                        : "text-[#64748B]/70 group-hover/nav:text-[#16A34A]",
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              );

              return (
                <li key={link.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold">
                        {link.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bottom User Section */}
        <div className="border-t border-neutral-200/30 p-4">
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10 shadow-sm"
                title={admin?.fullName || "Admin"}
              >
                <span className="text-xs font-bold text-[#16A34A]">
                  {(admin?.fullName || "A").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-[#FAFBFC] border border-neutral-200/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10">
                <span className="text-xs font-bold text-[#16A34A]">
                  {(admin?.fullName || "A").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {admin?.fullName || "Admin"}
                </p>
                <p className="text-[10px] font-medium text-[#64748B] truncate">
                  {admin?.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
