"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Layers,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import {
  fetchNotificationsPage,
  formatNotificationDisplay,
  getNotificationRedirectUrl,
  type Notification,
} from "@/lib/notifications-api";
import { useNotificationStore } from "@/store/notification-store";
import { useAuthStore } from "@/store/auth-store";
import { Loader2 } from "lucide-react";

const PAGE_SIZE = 20;

type FilterTab = "all" | "orders" | "account" | "alerts";

function NotificationsListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200/70 bg-white p-5 flex items-start gap-4"
        >
          <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-48 rounded-lg" />
              <Skeleton className="h-4 w-28 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getNotificationIcon(type: string, title: string) {
  const t = type.toUpperCase();
  const lowerTitle = title.toLowerCase();

  if (t.includes("ORDER") || lowerTitle.includes("order")) {
    if (t.includes("COMPLETED") || lowerTitle.includes("completed")) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    return <ShoppingBag className="w-5 h-5 text-green-600" />;
  }

  if (
    t.includes("SECURITY") ||
    t.includes("PASSWORD") ||
    lowerTitle.includes("password") ||
    lowerTitle.includes("security")
  ) {
    return <ShieldCheck className="w-5 h-5 text-green-600" />;
  }

  if (
    t.includes("KYC") ||
    t.includes("DEMAT") ||
    t.includes("BANK") ||
    t.includes("PROFILE") ||
    lowerTitle.includes("profile") ||
    lowerTitle.includes("account")
  ) {
    return <User className="w-5 h-5 text-green-600" />;
  }

  return <Bell className="w-5 h-5 text-green-600" />;
}

export default function NotificationPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const {
    unreadCount,
    setUnreadCount,
    fetchUnreadCount: storeFetchUnreadCount,
    markAllAsRead: storeMarkAllAsRead,
    markAsRead: storeMarkAsRead,
  } = useNotificationStore();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/notification");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [pageData] = await Promise.all([
          fetchNotificationsPage(1, PAGE_SIZE),
          storeFetchUnreadCount(),
        ]);

        if (cancelled) return;

        setNotifications(pageData.notifications);
        setPage(pageData.pagination.page);
        setHasMore(pageData.pagination.hasMore);
        setTotal(pageData.pagination.total);
      } catch {
        if (!cancelled) {
          console.error("Failed to load notifications");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storeFetchUnreadCount]);

  const canMarkAll =
    (unreadCount > 0 || notifications.some((n) => !n.isRead)) &&
    !loading &&
    notifications.length > 0;

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const pageData = await fetchNotificationsPage(nextPage, PAGE_SIZE);

      setNotifications((prev) => [...prev, ...pageData.notifications]);
      setPage(pageData.pagination.page);
      setHasMore(pageData.pagination.hasMore);
      setTotal(pageData.pagination.total);
    } catch {
      console.error("Failed to load more notifications");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!canMarkAll || markingAll) return;

    setMarkingAll(true);
    try {
      // 1. Immediately update cards in UI
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      // 2. Immediately zero out navbar badge via shared store
      await storeMarkAllAsRead();
    } catch {
      console.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkSingleAsRead = async (
    e: React.MouseEvent,
    notification: Notification,
  ) => {
    e.stopPropagation();
    if (notification.isRead) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );

    try {
      await storeMarkAsRead(notification.id);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: false } : n)),
      );
      console.error("Failed to mark notification as read");
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    const redirectUrl = getNotificationRedirectUrl(notification);

    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );

      try {
        await storeMarkAsRead(notification.id);
      } catch {
        // Revert optimistic UI update
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: false } : n)),
        );
        console.error("Failed to mark notification as read");
      }
    }

    if (redirectUrl) {
      router.push(redirectUrl);
    }
  };

  // Filter Counts
  const counts = useMemo(() => {
    const result = { all: notifications.length, orders: 0, account: 0, alerts: 0 };
    notifications.forEach((n) => {
      const t = n.type.toUpperCase();
      const title = n.title.toLowerCase();
      if (t.includes("ORDER") || title.includes("order")) {
        result.orders += 1;
      } else if (
        t.includes("SECURITY") ||
        t.includes("PASSWORD") ||
        title.includes("security") ||
        title.includes("password")
      ) {
        result.alerts += 1;
      } else {
        result.account += 1;
      }
    });
    return result;
  }, [notifications]);

  // Filtered List
  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => {
      const t = n.type.toUpperCase();
      const title = n.title.toLowerCase();
      if (activeTab === "orders") {
        return t.includes("ORDER") || title.includes("order");
      }
      if (activeTab === "alerts") {
        return (
          t.includes("SECURITY") ||
          t.includes("PASSWORD") ||
          title.includes("security") ||
          title.includes("password")
        );
      }
      if (activeTab === "account") {
        return (
          !t.includes("ORDER") &&
          !title.includes("order") &&
          !t.includes("SECURITY") &&
          !t.includes("PASSWORD") &&
          !title.includes("security") &&
          !title.includes("password")
        );
      }
      return true;
    });
  }, [activeTab, notifications]);

  const emptyState = !loading && filteredNotifications.length === 0;

  if (isAuthLoading || !isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="text-xs text-muted-foreground font-medium">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 md:p-8">
      {/* ─── Header ──────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Notifications
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Stay updated with your latest activities and alerts.
        </p>
      </div>

      {/* ─── Controls Bar: Category Filter Pills + Mark All Read ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Category Filter Pills (Inline-Flex, snug fit) */}
        <div className="inline-flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/70 overflow-x-auto no-scrollbar max-w-full">
          {/* All Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === "all"
                ? "bg-green-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              All
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold min-w-[18px] text-center",
                activeTab === "all"
                  ? "bg-white/25 text-white"
                  : "bg-slate-200/90 text-slate-600",
              )}
            >
              {counts.all}
            </span>
          </button>

          {/* Orders Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === "orders"
                ? "bg-green-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              Orders
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold min-w-[18px] text-center",
                activeTab === "orders"
                  ? "bg-white/25 text-white"
                  : "bg-slate-200/90 text-slate-600",
              )}
            >
              {counts.orders}
            </span>
          </button>

          {/* Account Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === "account"
                ? "bg-green-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Account
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold min-w-[18px] text-center",
                activeTab === "account"
                  ? "bg-white/25 text-white"
                  : "bg-slate-200/90 text-slate-600",
              )}
            >
              {counts.account}
            </span>
          </button>

          {/* Alerts Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === "alerts"
                ? "bg-green-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Alerts
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-extrabold min-w-[18px] text-center",
                activeTab === "alerts"
                  ? "bg-white/25 text-white"
                  : "bg-slate-200/90 text-slate-600",
              )}
            >
              {counts.alerts}
            </span>
          </button>
        </div>

        {/* Mark all as read Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleMarkAllAsRead()}
          disabled={!canMarkAll || markingAll}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-green-700 font-semibold text-xs gap-2 hover:bg-green-50/50 hover:border-green-200 transition-all shadow-sm disabled:opacity-50 self-start sm:self-auto shrink-0"
        >
          <Check className="w-4 h-4 text-green-600" />
          Mark all as read
        </Button>
      </div>

      {/* ─── Main Notification Cards List ──────────────────────────────── */}
      {loading ? (
        <NotificationsListSkeleton />
      ) : emptyState ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100 mx-auto mb-4">
            <Bell className="w-6 h-6 text-green-600 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No notifications</h3>
          <p className="text-xs text-slate-500 mt-1">
            You are all caught up! New alerts and activity updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredNotifications.map((n) => {
            const { title, message } = formatNotificationDisplay(n);
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    void handleNotificationClick(n);
                  }
                }}
                onClick={() => void handleNotificationClick(n)}
                className="group relative w-full bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:border-slate-300/80 transition-all duration-300 text-left flex items-start gap-3.5 sm:gap-4 overflow-hidden cursor-pointer active:scale-[0.995]"
              >
                {/* Rounded Green Left Accent Stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500 rounded-r-full" />

                {/* Type Icon Container */}
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-green-50/80 border border-green-100/80 flex items-center justify-center shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  {getNotificationIcon(n.type, title)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight leading-snug">
                      {title}
                    </h3>
                    {/* Desktop Date */}
                    <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 shrink-0">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-1">
                    {message}
                  </p>

                  {/* Mobile Date & Unread Indicator */}
                  <div className="sm:hidden flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatDateTime(n.createdAt)}
                    </span>
                    {!n.isRead && (
                      <button
                        type="button"
                        title="Mark as read"
                        onClick={(e) => void handleMarkSingleAsRead(e, n)}
                        className="p-1 -m-1"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-100 block" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-center shrink-0">
                  {/* Desktop Unread Dot / Quick Mark As Read */}
                  {!n.isRead && (
                    <button
                      type="button"
                      title="Mark as read"
                      onClick={(e) => void handleMarkSingleAsRead(e, n)}
                      className="group/btn p-1 -m-1 rounded-full hover:bg-green-100/60 transition-colors hidden sm:flex items-center justify-center"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-100 group-hover/btn:scale-125 transition-transform" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}

          {hasMore ? (
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl font-bold text-xs text-slate-700 border-slate-200 bg-white hover:bg-slate-50 shadow-sm"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Privacy & Security Footer Banner ──────────────────────────────── */}
      <div className="rounded-2xl bg-green-50/60 border border-green-100/80 p-4 sm:p-5 flex items-center gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-green-100/80 text-green-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-green-900/90 leading-relaxed">
          We&apos;ll never share your data with anyone. Your notifications are secure and private.
        </p>
      </div>
    </div>
  );
}
