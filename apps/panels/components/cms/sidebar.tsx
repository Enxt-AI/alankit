"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBasket,
  FileText,
  Newspaper,
  HelpCircle,
  FileEdit,
  MessageSquareQuote,
  Tags,
  Image,
} from "lucide-react";
import { notify } from "@/components/ui/floating-notification";

import { useAuthStore } from "@/store/auth-store";
import type { AdminPermission } from "@/types/admin";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CMSSidebarProps {
  className?: string;
  onLinkClick?: () => void;
  collapsed?: boolean;
}

const navLinks = [
  { href: "/cms/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/cms/stocks",
    label: "Stocks",
    icon: Package,
    permission: "cms_stocks",
  },
  {
    href: "/cms/upcoming-stocks",
    label: "Upcoming Stocks",
    icon: Package,
    permission: "cms_stocks",
  },
  {
    href: "/cms/stocks/categories",
    label: "Stock Categories",
    icon: Tags,
    permission: "cms_stocks",
  },
  {
    href: "/cms/baskets",
    label: "Baskets",
    icon: ShoppingBasket,
    permission: "cms_baskets",
  },
  {
    href: "/cms/articles",
    label: "Articles",
    icon: FileText,
    permission: "cms_articles",
  },
  { href: "/cms/news", label: "News", icon: Newspaper, permission: "cms_news" },
  {
    href: "/cms/faqs",
    label: "FAQs",
    icon: HelpCircle,
    permission: "cms_faqs",
  },
  {
    href: "/cms/static-pages",
    label: "Static Pages",
    icon: FileEdit,
    permission: "cms_static_pages",
  },
  {
    href: "/cms/seo-metadata",
    label: "SEO Settings",
    icon: FileEdit,
    permission: "cms_static_pages",
  },
  {
    href: "/cms/testimonials",
    label: "Testimonials",
    icon: MessageSquareQuote,
    permission: "cms_testimonials",
  },
  {
    href: "/cms/carousel",
    label: "Carousel Media",
    icon: Image,
    permission: "cms_carousel",
  },
];

export default function CMSSidebar({
  className,
  onLinkClick,
  collapsed = false,
}: CMSSidebarProps) {
  const { cmsAdmin } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const hasPermission = (permission: AdminPermission) => {
    if (cmsAdmin?.role === "SUPER_ADMIN") return true;
    if (!cmsAdmin?.permissions) return false;
    if (cmsAdmin.permissions.includes(permission)) return true;
    return false;
  };

  const handleNav = (href: string, permission?: string) => {
    if (permission && !hasPermission(permission as AdminPermission)) {
      notify.error(`Access denied to ${href}. Contact admin.`);
      return;
    }
    router.push(href);
    onLinkClick?.();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label="CMS navigation"
        className={cn(
          "flex h-screen flex-col bg-white border-r border-neutral-200/30 py-2 transition-all duration-300",
          className,
        )}
      >
        {/* Brand */}
        <div className={cn("pt-6 pb-5 transition-all duration-300", collapsed ? "px-2 text-center" : "px-7")}>
          {collapsed ? (
            <span className="text-[18px] font-black text-[#16A34A] tracking-tight">SMC</span>
          ) : (
            <h1 className="text-[20px] font-extrabold tracking-tight leading-none text-[#0F172A] whitespace-nowrap">
              <span className="text-[#16A34A]">SMC</span> CMS
            </h1>
          )}
        </div>

        {/* Navigation Section */}
        <div className={cn("flex-1 overflow-y-auto pt-3 transition-all duration-300", collapsed ? "px-2" : "px-4")}>
          {!collapsed && (
            <p className="px-4 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#64748B]/60">Menu</p>
          )}
          <ul className="space-y-1">
            {navLinks.map((link) => {
              if (
                link.permission &&
                !hasPermission(link.permission as AdminPermission)
              ) {
                return null;
              }

              const Icon = link.icon;
              const active = isActive(link.href);

              const linkContent = (
                <button
                  onClick={() => handleNav(link.href, link.permission)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav flex w-full items-center transition-all duration-300 ease-in-out text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2",
                    collapsed ? "justify-center p-2.5 rounded-xl" : "gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold",
                    active
                      ? "bg-[#DCFCE7]/70 text-[#16A34A]"
                      : "text-[#64748B] bg-transparent hover:bg-[#ECFDF5] hover:text-[#0F172A]"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-colors duration-300 ease-in-out shrink-0",
                      collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                      active ? "text-[#16A34A]" : "text-[#64748B]/70 group-hover/nav:text-[#16A34A]"
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span>{link.label}</span>}
                </button>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10 shadow-sm" title={cmsAdmin?.fullName || 'User'}>
                <span className="text-xs font-bold text-[#16A34A]">
                  {(cmsAdmin?.fullName || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-[#FAFBFC] border border-neutral-200/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] border border-[#16A34A]/10">
                <span className="text-xs font-bold text-[#16A34A]">
                  {(cmsAdmin?.fullName || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {cmsAdmin?.fullName || 'User'}
                </p>
                <p className="text-[10px] font-medium text-[#64748B] truncate">
                  {cmsAdmin?.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
