"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ShoppingBag,
  TicketPercent,
} from "lucide-react";
import { ComponentType } from "react";

import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MarketingSidebarProps {
  className?: string;
  onLinkClick?: () => void;
  collapsed?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: ComponentType<any>;
  /** Hidden from the sidebar but still routable (e.g. via direct URL) */
  hidden?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/marketing/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketing/leads", label: "Leads", icon: Users },
  {
    href: "/marketing/dropped-checkouts",
    label: "Dropped Checkouts",
    icon: ShoppingBag,
  },
  { href: "/marketing/promotions", label: "Promotions", icon: TicketPercent },
  {
    href: "/marketing/reports",
    label: "Reports",
    icon: BarChart3,
    hidden: true,
  },
];

export default function MarketingSidebar({
  className,
  onLinkClick,
  collapsed = false,
}: MarketingSidebarProps) {
  const { marketingAdmin } = useAuthStore();
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const filteredNavLinks = navLinks.filter((link) => {
    if (link.hidden) return false;
    if (marketingAdmin?.role === "SUPER_ADMIN") return true;
    if (link.href === "/marketing/dashboard") {
      return marketingAdmin?.permissions?.includes("marketing_dashboard_view");
    }
    if (link.href === "/marketing/reports") {
      return marketingAdmin?.permissions?.includes("marketing_reports_view");
    }
    if (link.href === "/marketing/leads") {
      return (
        marketingAdmin?.permissions?.includes("marketing_view") ||
        marketingAdmin?.role === "SALES_EMPLOYEE"
      );
    }
    if (link.href === "/marketing/dropped-checkouts") {
      return marketingAdmin?.permissions?.includes("marketing_view");
    }
    if (link.href === "/marketing/promotions") {
      return true; // All authenticated marketing panel users can view promotions
    }
    return true;
  });

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="Marketing navigation"
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
              <span className="text-[#16A34A]"></span> Marketing
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
            {filteredNavLinks.map((link) => {
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
                title={marketingAdmin?.fullName || "User"}
              >
                <span className="text-xs font-bold text-[#16A34A]">
                  {(marketingAdmin?.fullName || "M").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-[#FAFBFC] border border-neutral-200/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10">
                <span className="text-xs font-bold text-[#16A34A]">
                  {(marketingAdmin?.fullName || "M").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {marketingAdmin?.fullName || "User"}
                </p>
                <p className="text-[10px] font-medium text-[#64748B] truncate">
                  {marketingAdmin?.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
