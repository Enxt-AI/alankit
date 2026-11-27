"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  BookOpen,
  FileCheck,
  Building2,
  CalendarDays,
  Scale,
  ContactRound,
  X,
  ChevronsLeft,
  ChevronsRight,
  BarChart3,
  PlusCircle,
  ArrowRightLeft,
  CreditCard,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/accounting/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Chart of Accounts",
    href: "/accounting/chart-of-accounts",
    icon: BookOpen,
  },
  {
    title: "Chart of Stocks",
    href: "/accounting/chart-of-stocks",
    icon: BarChart3,
  },
  {
    title: "Day Book",
    href: "/accounting/day-book",
    icon: CalendarDays,
  },
  {
    title: "Vouchers",
    href: "/accounting/vouchers",
    icon: FileCheck,
  },
  {
    title: "Sunsystem Transfer",
    href: "/accounting/sunsystem-transfer",
    icon: ArrowRightLeft,
  },
  {
    title: "Voucher Entry",
    href: "/accounting/voucher-entry",
    icon: PlusCircle,
  },
  {
    title: "Trial Balance",
    href: "/accounting/trial-balance",
    icon: Scale,
  },
  {
    title: "Invoices",
    href: "/accounting/invoices",
    icon: FileText,
  },
  {
    title: "Contact Master",
    href: "/accounting/contact-master",
    icon: ContactRound,
  },
  {
    title: "Master Settings",
    href: "/accounting/master-settings",
    icon: Settings,
  },
  {
    title: "Cashfree Reconciliation",
    href: "/accounting/cashfree-reconciliation",
    icon: CreditCard,
  },
  {
    title: "Bank Settlements",
    href: "/accounting/bank-settlements",
    icon: Landmark,
  },
];

interface AccountingSidebarProps {
  onLinkClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AccountingSidebar({
  onLinkClick,
  collapsed = false,
  onToggleCollapse,
}: AccountingSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-card">
        {/* Header */}
        <div
          className={cn(
            "flex h-16 items-center border-b transition-all duration-300",
            collapsed
              ? "justify-center px-2 text-center"
              : "justify-between px-6",
          )}
        >
          <Link href="/accounting/dashboard" className="flex items-center">
            {collapsed ? (
              <span className="text-[18px] font-black text-[#16A34A] tracking-tight"></span>
            ) : (
              <h1 className="text-[20px] font-extrabold tracking-tight leading-none text-[#0F172A] whitespace-nowrap">
                <span className="text-[#16A34A]"></span> Accounting Panel
              </h1>
            )}
          </Link>
          {onLinkClick && !collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onLinkClick}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex-1 space-y-1 p-4 transition-all duration-300",
            collapsed && "px-2",
          )}
        >
          {navItems.map((item) => {
            const isActive = currentUrl === item.href || pathname === item.href;
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-emerald-50 text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700",
                )}
              >
                <item.icon
                  className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")}
                />
                {!collapsed && item.title}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer info (hidden when collapsed) */}
        {!collapsed && (
          <div className="border-t p-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Accounting Panel
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Manage your finances and invoices in one place.
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
