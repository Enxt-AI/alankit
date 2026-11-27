"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  ShoppingCart,
  BarChart3,
  Heart,
  IndianRupee,
  Share2,
  ShoppingBag,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { type AdminPermission } from "@/types/admin";

interface OperationSidebarProps {
  className?: string;
  onLinkClick?: () => void;
  collapsed?: boolean;
}

interface NavLinkItem {
  href: string;
  label: string;
  icon: any;
  permission?: AdminPermission;
}

const navLinks: NavLinkItem[] = [
  {
    href: "/operation/dashboard",
    label: "NSDL BATCH",
    icon: Database,
    permission: "nsdl_batch",
  },
  {
    href: "/operation/orders",
    label: "Order Management",
    icon: ShoppingCart,
    permission: "update_orders",
  },
  {
    href: "/operation/demat-approval",
    label: "Demat Approval",
    icon: FileCheck,
    permission: "demat_approval",
  },
  {
    href: "/operation/chart-of-stocks",
    label: "Chart of Stocks",
    icon: BarChart3,
    permission: "chart_of_stocks",
  },
  {
    href: "/operation/stock-pricing",
    label: "Stock Pricing",
    icon: IndianRupee,
    permission: "manage_stocks",
  },
  {
    href: "/operation/revenue-sharing",
    label: "Revenue Sharing",
    icon: Share2,
    permission: "revenue_sharing",
  },
  {
    href: "/operation/stock-interests",
    label: "Stock Interests",
    icon: Heart,
    permission: "stock_interests",
  },
  {
    href: "/operation/sell-requests",
    label: "Sell Requests",
    icon: ShoppingBag,
    permission: "sell_requests",
  },
];

export default function OperationSidebar({
  className,
  onLinkClick,
  collapsed = false,
}: OperationSidebarProps) {
  const pathname = usePathname();
  const { operationAdmin } = useAuthStore();

  const isSuperAdmin = operationAdmin?.role === "SUPER_ADMIN";
  const hasPermission = (permission?: AdminPermission) => {
    if (!permission) return true;
    if (isSuperAdmin) return true;
    if (permission === "demat_approval") {
      return (
        operationAdmin?.permissions?.includes("demat_approval") ||
        operationAdmin?.permissions?.includes("cms_demat_approval") ||
        false
      );
    }
    return operationAdmin?.permissions?.includes(permission) ?? false;
  };

  const visibleLinks = navLinks.filter((link) =>
    hasPermission(link.permission),
  );

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="Operation navigation"
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
              <span className="text-[#16A34A]"></span> Operations
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
            {visibleLinks.map((link) => {
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
                title={operationAdmin?.fullName || "Operator"}
              >
                <span className="text-xs font-bold text-[#16A34A]">
                  {(operationAdmin?.fullName || "O").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-[#FAFBFC] border border-neutral-200/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10">
                <span className="text-xs font-bold text-[#16A34A]">
                  {(operationAdmin?.fullName || "O").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {operationAdmin?.fullName || "Operator"}
                </p>
                <p className="text-[10px] font-medium text-[#64748B] truncate">
                  {operationAdmin?.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
