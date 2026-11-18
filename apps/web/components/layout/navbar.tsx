"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Search,
  Home,
  Info,
  HeadphonesIcon,
  LayoutGrid,
  Newspaper,
  BookOpen,
  Phone,
  ShieldCheck,
  FileText,
  Settings,
  User,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuthStore } from "@/store/auth-store";
import { cn, generateSlug, getStockSlug } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileSidebar } from "./Sidebar";
import {
  fetchRecentNotifications,
  fetchUnreadCount,
  formatNotificationDisplay,
  getNotificationRedirectUrl,
  markAsRead,
  type Notification,
} from "@/lib/notifications-api";
import { NotificationSkeleton } from "@/components/notifications/notification-skeleton";
import { NavbarSkeleton } from "./navbar-skeleton";
import { useNews } from "@/hooks/use-content";
import { useStocks } from "@/hooks/use-stocks";
import { newsUrl } from "@/lib/slugify";
import { useNotificationStore } from "@/store/notification-store";

/**
 * Navbar Component
 */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  const {
    unreadCount,
    fetchUnreadCount: storeFetchUnreadCount,
    markAsRead: storeMarkAsRead,
    setUnreadCount,
  } = useNotificationStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: allNews } = useNews();
  const { data: allStocks } = useStocks();

  // Site pages for search
  const sitePages = useMemo(
    () => [
      { name: "Home", href: "/", icon: Home, desc: "Landing page" },
      {
        name: "About Us",
        href: "/about",
        icon: Info,
        desc: "About the company",
      },
      {
        name: "Stocks",
        href: "/stocks",
        icon: TrendingUp,
        desc: "Browse all stocks",
      },
      {
        name: "Support",
        href: "/supports",
        icon: HeadphonesIcon,
        desc: "Get help",
      },
      {
        name: "Stock Basket",
        href: "/baskets",
        icon: LayoutGrid,
        desc: "Curated baskets",
      },
      { name: "News", href: "/news", icon: Newspaper, desc: "Latest news" },
      {
        name: "Articles",
        href: "/articles",
        icon: BookOpen,
        desc: "Read articles",
      },
      {
        name: "Contact Us",
        href: "/contact-us",
        icon: Phone,
        desc: "Reach out",
      },
      { name: "KYC", href: "/kyc", icon: ShieldCheck, desc: "Verify identity" },
      { name: "Demat", href: "/demat", icon: FileText, desc: "Demat account" },
      {
        name: "Legal Policies",
        href: "/legal-policies",
        icon: FileText,
        desc: "Terms & policies",
      },
      {
        name: "Notifications",
        href: "/notification",
        icon: Bell,
        desc: "Your alerts",
      },
      { name: "Profile", href: "/profile", icon: User, desc: "Your account" },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        desc: "App settings",
      },
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
        desc: "Your dashboard",
      },
    ],
    [],
  );

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sitePages
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [searchQuery, sitePages]);

  const filteredNews = useMemo(() => {
    if (!searchQuery.trim() || !allNews) return [];
    const q = searchQuery.toLowerCase();
    return allNews.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 5);
  }, [searchQuery, allNews]);

  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim() || !allStocks) return [];
    const q = searchQuery.toLowerCase();
    return allStocks
      .filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.cin?.toLowerCase().includes(q) ||
          s.isin?.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [searchQuery, allStocks]);

  const hasResults =
    filteredPages.length > 0 ||
    filteredNews.length > 0 ||
    filteredStocks.length > 0;

  const unreadInFlightRef = useRef(false);
  const recentInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const navLink = (href: string) =>
    cn(
      "text-xs xl:text-sm font-semibold whitespace-nowrap transition-colors",
      pathname === href
        ? "text-green-600"
        : "text-slate-600 hover:text-green-600",
    );

  /**
   * Poll unread count every 3 minutes.
   *
   * Requirements:
   * - Fetch on mount
   * - Poll interval = 180000ms
   * - Best-effort: failures should not break navbar rendering
   */
  useEffect(() => {
    setIsMounted(true);
    mountedRef.current = true;

    if (!isAuthenticated) {
      setUnreadCount(0);
      return () => {
        mountedRef.current = false;
      };
    }

    const loadUnread = async () => {
      if (unreadInFlightRef.current) return;
      unreadInFlightRef.current = true;

      try {
        await storeFetchUnreadCount();
      } catch {
        // Keep last-known unread badge; don't spam toasts for polling failures.
      } finally {
        unreadInFlightRef.current = false;
      }
    };

    void loadUnread();
    const id = setInterval(loadUnread, 180000);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [isAuthenticated, storeFetchUnreadCount, setUnreadCount]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Fetch recent notifications only when dropdown opens.
   */
  useEffect(() => {
    const loadRecent = async () => {
      if (!dropdownOpen || !isAuthenticated) return;
      if (recentInFlightRef.current) return;
      recentInFlightRef.current = true;

      setLoading(true);
      try {
        const recent = await fetchRecentNotifications(5);
        if (mountedRef.current) {
          setNotifications(recent);
        }
      } catch {
        console.error("Failed to load notifications");
        if (mountedRef.current) {
          setNotifications([]);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
        recentInFlightRef.current = false;
      }
    };

    void loadRecent();
  }, [dropdownOpen, isAuthenticated]);

  const handleNotificationClick = async (notification: Notification) => {
    // Optimistically mark as read in UI and decrement badge via store.
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: true } : n,
        ),
      );
      try {
        await storeMarkAsRead(notification.id);
      } catch {
        console.error("Failed to mark notification as read");
      }
    }

    const redirectUrl = getNotificationRedirectUrl(notification);
    if (redirectUrl) {
      router.push(redirectUrl);
    }
  };

  if (!isMounted) {
    return <NavbarSkeleton />;
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b bg-white">
      <div className="relative flex h-full items-center justify-between gap-3 px-4 sm:px-4 md:px-6 xl:px-8">
        {/* LEFT */}
        <div className="relative z-10 flex min-w-0 items-center gap-3 sm:gap-3 shrink-0">
          <MobileSidebar />

          <Link href="/" className="flex min-w-0 items-center shrink-0">
            <Image
              src="/logo.png"
              alt="UnlistedSTOX"
              width={218}
              height={39}
              className="w-[92px] min-[360px]:w-[105px] min-[375px]:w-[125px] sm:w-[135px] md:w-[145px] xl:w-[190px]"
              style={{ height: "auto" }}
              priority
            />
          </Link>
        </div>

        {/* CENTER */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 lg:gap-4 xl:gap-6 pointer-events-auto">
          <Link href="/" className={navLink("/")}>
            Home
          </Link>

          <Link href="/about" className={navLink("/about")}>
            About us
          </Link>

          <Link href="/stocks" className={navLink("/stocks")}>
            Unlisted Stocks
          </Link>

          {/* <Link href="/unlisted-shares-price-list" className={navLink("/unlisted-shares-price-list")}>
            Share Prices
          </Link> */}

          <Link href="/baskets" className={navLink("/baskets")}>
            Stock Basket
          </Link>
          {isAuthenticated && (
            <Link href="/supports" className={navLink("/supports")}>
              Support
            </Link>
          )}
        </div>

        {/* RIGHT */}
        <div className="relative z-10 flex items-center justify-end gap-2 sm:gap-3 shrink-0">
          {/* Search */}
          <div className="hidden lg:flex items-center relative" ref={searchRef}>
            <Search className="absolute left-2.5 sm:left-3 h-3.5 w-3.5 xl:h-4 xl:w-4 text-muted-foreground z-10 pointer-events-none" />
            <Input
              placeholder="Search stocks"
              className="pl-7 sm:pl-8 pr-2 w-[150px] lg:w-[170px] xl:w-[210px] text-xs xl:text-sm h-9 xl:h-10 rounded-xl bg-slate-50/80 border-slate-200 focus-visible:ring-green-500 focus-visible:bg-white transition-all duration-200 focus:w-[175px] lg:focus:w-[210px] xl:focus:w-[250px]"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => searchQuery.length > 0 && setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            {searchOpen && searchQuery.length > 0 && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 max-h-[400px] overflow-y-auto w-[300px]">
                {!hasResults ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No results found
                  </div>
                ) : (
                  <>
                    {/* Pages section */}
                    {filteredPages.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                          Pages
                        </div>
                        {filteredPages.map((page) => {
                          const Icon = page.icon;
                          return (
                            <Link
                              key={page.href}
                              href={page.href}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                              onClick={() => {
                                setSearchQuery("");
                                setSearchOpen(false);
                              }}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                <Icon size={16} className="text-gray-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900">
                                  {page.name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {page.desc}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </>
                    )}
                    {/* News section */}
                    {filteredNews.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                          News
                        </div>
                        {filteredNews.map((article) => (
                          <Link
                            key={article.id}
                            href={newsUrl(article.title)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setSearchQuery("");
                              setSearchOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <Newspaper size={16} className="text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {article.title}
                              </div>
                              <div className="text-xs text-gray-400">
                                News article
                              </div>
                            </div>
                          </Link>
                        ))}
                      </>
                    )}
                    {/* Stocks section */}
                    {filteredStocks.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                          Stocks
                        </div>
                        {filteredStocks.map((stock) => (
                          <Link
                            key={stock.id}
                            href={`/stocks/${getStockSlug(stock)}`}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setSearchQuery("");
                              setSearchOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                              <TrendingUp
                                size={16}
                                className="text-green-500"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate flex justify-between gap-2">
                                <span className="truncate">{stock.name}</span>
                                {stock.price && (
                                  <span className="text-green-600 font-semibold shrink-0">
                                    ₹{stock.price}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                {stock.cin || stock.isin || "Unlisted Stock"}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <>
              {/* Notifications Link (No dropdown) */}
              <Link href="/notification">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  className="relative h-10 w-10 xl:h-11 xl:w-11 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <BellRing className="h-[21px] w-[21px] xl:h-6 xl:w-6 stroke-[1.8]" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </Link>

              {/* Profile */}
              <Link href="/profile" className="outline-none block ml-1">
                <Avatar className="h-7 w-7 md:h-9 md:w-9 cursor-pointer">
                  <AvatarImage src="/profile.png" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </Link>
            </>
          ) : (
            <Button
              asChild
              className="bg-green-600 hover:bg-green-700 h-8 sm:h-9 xl:h-10 text-[11px] sm:text-xs xl:text-sm px-3 sm:px-4 font-semibold rounded-lg whitespace-nowrap shrink-0 shadow-sm"
            >
              {/* Rehydrate the session and avoid cached auth redirects after logout. */}
              <a href="/login">
                Login / Sign Up
              </a>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
