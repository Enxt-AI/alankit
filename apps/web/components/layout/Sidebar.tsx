"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  User,
  LayoutDashboard,
  PieChart,
  Star,
  BarChart2,
  Settings,
  LogOut,
  Landmark,
  ShoppingBag,
  Ticket,
  Home,
  Compass,
  Search,
  MessageCircle,
  Info,
} from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

import { useAuthStore } from "@/store/auth-store";
import { MobileSearchOverlay } from "./MobileSearchOverlay";

/* ------------------ MENU CONFIG ------------------ */

type MenuItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  variant?: "default" | "ghost";
  action?: string;
  hideOnMobile?: boolean;
};

type MenuSection = {
  title?: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    items: [
      { label: "My Profile", icon: User, href: "/profile", hideOnMobile: true },
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Portfolio", icon: PieChart, href: "/dashboard/portfolio" },
      { label: "Watchlist", icon: Star, href: "/dashboard/watchlist" },
      { label: "Orders", icon: BarChart2, href: "/dashboard/orders" },
      { label: "Tickets", icon: Ticket, href: "/dashboard/tickets" },
      { label: "Sell Requests", icon: ShoppingBag, href: "/dashboard/sell-requests" },
      { label: "Bank", icon: Landmark, href: "/dashboard/bank" },
      { label: "Settings", icon: Settings, href: "/settings" },
      { label: "Logout", icon: LogOut, action: "logout" },
    ],
  },
];

const primaryMenuItems: MenuItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Compass, href: "/stocks" },
  { label: "Baskets", icon: ShoppingBag, href: "/baskets" },
  { label: "About Us", icon: Info, href: "/about" },
];

/* ------------------ SIDEBAR ITEM COMPONENT ------------------ */

function SidebarItem({
  item,
  onClick,
}: {
  item: MenuItem;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    item.href &&
    (pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/" &&
        pathname.startsWith(item.href + "/")));

  if (!item.href) {
    const isDestructive = item.action === "logout";
    return (
      <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
          "w-full justify-start gap-3.5 px-4 h-11 font-medium transition-all duration-200 rounded-xl text-xs hover:scale-[1.02] active:scale-100",
          isDestructive
            ? "text-red-500 hover:text-red-600 hover:bg-red-50/50"
            : "text-slate-500 hover:bg-slate-50/50 hover:text-slate-900",
        )}
      >
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0",
            isDestructive ? "text-red-500" : "text-slate-400",
          )}
        />
        {item.label}
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3.5 px-4 h-11 font-medium transition-all duration-200 rounded-xl text-[14px] relative hover:scale-[1.01] active:scale-100",
        isActive
          ? "bg-[#e6f5ea] text-green-700 font-semibold"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
      )}
    >
      <Link href={item.href} onClick={onClick} aria-current={isActive ? "page" : undefined}>
        <item.icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            isActive ? "text-green-700" : "text-slate-500",
          )}
          strokeWidth={2}
        />
        {item.label}
      </Link>
    </Button>
  );
}

/* ------------------ SIDEBAR CONTENT ------------------ */

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { logout } = useAuthStore();
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/login?clear=true";
      onClose?.();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-4">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {section.title && (
              <h4 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                {section.title}
              </h4>
            )}
            <nav className="space-y-1">
              {section.items.map((item) => {
                const isLogout = item.action === "logout";
                return (
                  <SidebarItem
                    key={item.label}
                    item={item}
                    onClick={isLogout ? handleLogout : onClose}
                  />
                );
              })}
            </nav>
            {idx < menuSections.length - 1 && (
              <Separator className="my-2.5 bg-slate-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------ MOBILE SIDEBAR ITEMS & CONTENT ------------------ */

function MobileSidebarItem({ item, onClick }: { item: MenuItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    item.href &&
    (pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/" &&
        pathname.startsWith(item.href + "/")));

  if (!item.href) {
    const isDestructive = item.action === "logout";
    return (
      <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
          "w-full justify-start gap-4 px-6 h-12 font-medium transition-all duration-200 rounded-xl text-[15px] hover:scale-[1.02] active:scale-100",
          isDestructive
            ? "text-red-500 hover:text-red-600 hover:bg-red-50/50"
            : "text-slate-500 hover:bg-slate-50/50 hover:text-slate-900",
        )}
      >
        <item.icon
          className={cn(
            "h-5 w-5 shrink-0",
            isDestructive ? "text-red-500" : "text-slate-400",
          )}
        />
        {item.label}
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "w-full justify-start gap-4 px-6 h-12 font-medium transition-all duration-200 rounded-xl text-[15px] relative hover:scale-[1.01] active:scale-100",
        isActive
          ? "bg-[#e6f5ea] text-green-700 font-semibold"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
      )}
    >
      <Link href={item.href} onClick={onClick} aria-current={isActive ? "page" : undefined}>
        <item.icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            isActive ? "text-green-700" : "text-slate-500",
          )}
          strokeWidth={2}
        />
        {item.label}
      </Link>
    </Button>
  );
}

function MobileSidebarContent({
  onClose,
  onSearch,
}: {
  onClose: () => void;
  onSearch: () => void;
}) {
  const { isAuthenticated, logout } = useAuthStore();
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/login?clear=true";
      onClose?.();
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white pt-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] space-y-4">
      <nav aria-label="Main navigation" className="space-y-1 px-4">
        {primaryMenuItems.map((item) => (
          <MobileSidebarItem key={item.label} item={item} onClick={onClose} />
        ))}
        {isAuthenticated && (
          <>
            <MobileSidebarItem item={{ label: "Search", icon: Search, action: "search" }} onClick={onSearch} />
            <MobileSidebarItem item={{ label: "Support", icon: MessageCircle, href: "/supports" }} onClick={onClose} />
          </>
        )}
      </nav>
      {isAuthenticated && (
        <>
          <Separator className="bg-slate-100 mx-6 w-auto" />
          <h4 className="px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest">My account</h4>
          {menuSections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              {section.title && (
                <h4 className="px-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                  {section.title}
                </h4>
              )}
              <nav aria-label="Account navigation" className="space-y-1 px-4">
                {section.items
                  .filter((item) => !item.hideOnMobile)
                  .map((item) => {
                    const isLogout = item.action === "logout";
                    return (
                      <MobileSidebarItem
                        key={item.label}
                        item={item}
                        onClick={isLogout ? handleLogout : onClose}
                      />
                    );
                  })}
              </nav>
              {idx < menuSections.length - 1 && (
                <Separator className="my-2.5 bg-slate-100 mx-6 w-auto" />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------ MOBILE SIDEBAR ------------------ */

const CustomMenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="8" x2="20" y2="8"></line>
    <line x1="4" y1="16" x2="14" y2="16"></line>
  </svg>
);

export function MobileSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setShowSearch(false);
  };

  useEffect(() => {
    setIsOpen(false);
    setShowSearch(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        setIsOpen(false);
        setShowSearch(false);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0 -ml-1">
          <CustomMenuIcon />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[320px] max-w-[calc(100vw-2rem)] gap-0 p-0 flex flex-col bg-white rounded-r-[32px] border-none shadow-[4px_0_24px_rgba(0,0,0,0.08)]"
      >
        <SheetHeader className="border-b border-slate-50 h-20 flex p-6 shrink-0 justify-center">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SheetDescription className="sr-only">Browse stocks, baskets, and your account.</SheetDescription>
          <Link href="/" onClick={() => handleOpenChange(false)} className="w-fit">
            <Image
              src="/logo.png"
              alt="UnlistedSTOX"
              width={140}
              height={28}
              priority
              className="h-8 w-auto ml-2"
            />
          </Link>
        </SheetHeader>

        {showSearch ? (
          <MobileSearchOverlay onClose={() => setShowSearch(false)} onNavigate={() => handleOpenChange(false)} />
        ) : (
          <MobileSidebarContent onClose={() => handleOpenChange(false)} onSearch={() => setShowSearch(true)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------ DESKTOP SIDEBAR ------------------ */

export default function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-[240px] flex-col border-r border-slate-100 bg-white z-40">
      <SidebarContent />
    </aside>
  );
}
