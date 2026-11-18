"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { useStocks } from "@/hooks/use-stocks";
import { useNews, useArticles } from "@/hooks/use-content";
import { useBaskets } from "@/hooks/use-baskets";
import { slugify } from "@/lib/slugify";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Static route label dictionary for known sections.
 */
const ROUTE_LABELS: Record<string, string> = {
  stocks: "Unlisted Shares",
  baskets: "Stock Baskets",
  news: "Market News",
  articles: "Insights & Articles",
  "upcoming-stocks": "Upcoming Pre-IPO",
  supports: "Help & Support",
  about: "About Us",
  "contact-us": "Contact Us",
  kyc: "KYC Verification",
  bank: "Bank Verification",
  demat: "Demat Verification",
  dashboard: "Dashboard",
  orders: "Orders",
  portfolio: "Portfolio",
  watchlist: "Watchlist",
  tickets: "Support Tickets",
  "sell-requests": "Sell Requests",
  profile: "Profile",
  settings: "Settings",
  "legal-policies": "Legal & Policies",
  "terms-and-conditions": "Terms & Conditions",
  "privacy-policy": "Privacy Policy",
  disclaimer: "Disclaimer",
  "cookie-policy": "Cookie Policy",
  "acceptable-use": "Acceptable Use",
  "refund-policy": "Refund Policy",
  notification: "Notifications",
  buy: "Buy Shares",
  sell: "Sell Shares",
  payment: "Payment",
  success: "Success",
  failed: "Failed",
  verify: "Verify",
};

/**
 * Format raw URL segments when not found in dictionaries.
 * e.g., 'tata-capital-limited' -> 'Tata Capital Limited'
 */
function formatSegmentTitle(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    // If it's an order ID or ticket ID
    if (/^ord[-_]/i.test(decoded)) {
      return `Order #${decoded.replace(/^ord[-_]/i, "").slice(-8).toUpperCase()}`;
    }
    if (/^tck[-_]/i.test(decoded)) {
      return `Ticket #${decoded.replace(/^tck[-_]/i, "").slice(-6).toUpperCase()}`;
    }
    return decoded
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return segment;
  }
}

interface BreadcrumbsProps {
  /** Optional custom class for the outer container */
  containerClassName?: string;
  /** Optional custom class for the nav element */
  className?: string;
  /** Pass true to hide on specific custom views if needed */
  hide?: boolean;
}

export function Breadcrumbs({
  containerClassName,
  className,
  hide = false,
}: BreadcrumbsProps) {
  const pathname = usePathname();

  // TanStack hooks for resolving dynamic entity names
  const { data: allStocks } = useStocks();
  const { data: allNews } = useNews();
  const { data: allArticles } = useArticles();
  const { data: allBaskets } = useBaskets();

  const breadcrumbs = useMemo(() => {
    if (!pathname || pathname === "/" || hide) return null;

    // Suppress on auth and utility routes where breadcrumbs are not appropriate
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/offline") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/payment")
    ) {
      return null;
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const items: Array<{
      label: string;
      href: string;
      isLast: boolean;
      isHome?: boolean;
    }> = [
      {
        label: "Home",
        href: "/",
        isLast: false,
        isHome: true,
      },
    ];

    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const parentSegment = index > 0 ? segments[index - 1] : "";
      const decodedSegment = decodeURIComponent(segment).toLowerCase();

      let label = ROUTE_LABELS[segment.toLowerCase()];

      // Dynamic entity lookups based on parent route
      if (!label) {
        if (parentSegment === "stocks") {
          const stock = allStocks?.find(
            (s) =>
              s.id?.toLowerCase() === decodedSegment ||
              s.slug?.toLowerCase() === decodedSegment ||
              slugify(s.name)?.toLowerCase() === decodedSegment ||
              s.name?.toLowerCase() === decodedSegment
          );
          if (stock?.name) {
            label = stock.name;
          }
        } else if (parentSegment === "baskets") {
          const basket = allBaskets?.find(
            (b) =>
              b.id?.toLowerCase() === decodedSegment ||
              (b as any).slug?.toLowerCase() === decodedSegment ||
              slugify(b.name)?.toLowerCase() === decodedSegment ||
              b.name?.toLowerCase() === decodedSegment
          );
          if (basket?.name) {
            label = basket.name;
          }
        } else if (parentSegment === "news") {
          const news = allNews?.find(
            (n) =>
              n.id?.toLowerCase() === decodedSegment ||
              slugify(n.title)?.toLowerCase() === decodedSegment ||
              n.title?.toLowerCase() === decodedSegment
          );
          if (news?.title) {
            label = news.title;
          }
        } else if (parentSegment === "articles") {
          const article = allArticles?.find(
            (a) =>
              a.id?.toLowerCase() === decodedSegment ||
              slugify(a.title)?.toLowerCase() === decodedSegment ||
              a.title?.toLowerCase() === decodedSegment
          );
          if (article?.title) {
            label = article.title;
          }
        } else if (parentSegment === "tickets") {
          label = `Ticket #${segment.replace(/^tck[-_]/i, "").slice(-6).toUpperCase()}`;
        } else if (parentSegment === "orders") {
          label = `Order #${segment.replace(/^ord[-_]/i, "").slice(-8).toUpperCase()}`;
        }
      }

      // Fallback formatting
      if (!label) {
        label = formatSegmentTitle(segment);
      }

      items.push({
        label,
        href: currentPath,
        isLast,
      });
    });

    return items;
  }, [pathname, hide, allStocks, allNews, allArticles, allBaskets]);

  if (!breadcrumbs || breadcrumbs.length <= 1) {
    return null;
  }

  // If containerClassName is explicitly set to "none", skip wrapping container
  const isCustomContainer = containerClassName === "none";

  const content = (
    <Breadcrumb className={cn("py-1", className)}>
      <BreadcrumbList className="flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar whitespace-nowrap text-xs sm:text-sm font-medium">
        {breadcrumbs.map((item) => (
          <React.Fragment key={item.href}>
            <BreadcrumbItem className="inline-flex items-center shrink-0">
              {item.isLast ? (
                <BreadcrumbPage className="text-slate-900 font-semibold truncate max-w-[170px] sm:max-w-[320px] md:max-w-[500px]">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {item.isHome && (
                      <Home className="w-3.5 h-3.5 mr-1.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                    )}
                    <span>{item.label}</span>
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!item.isLast && (
              <BreadcrumbSeparator className="shrink-0 text-slate-300">
                <ChevronRight className="w-3.5 h-3.5" />
              </BreadcrumbSeparator>
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );

  if (isCustomContainer) {
    return content;
  }

  return (
    <div
      className={cn(
        "w-full px-3 sm:px-4 md:px-6 xl:px-8 pt-2 sm:pt-2.5 pb-1 transition-all",
        containerClassName
      )}
    >
      {content}
    </div>
  );
}
