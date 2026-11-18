import { stocksApi } from "@/lib/api-client";

/**
 * In-app notifications API client (stocks-service).
 *
 * Notes:
 * - Uses the shared Axios client which relies on the backend-set HttpOnly `auth_token` cookie.
 * - No Bearer token is required for user notifications.
 */

export interface NotificationMetadata {
  redirectUrl?: string;
  orderId?: string;
  basketId?: string;
  basketSlug?: string;
  stockId?: string;
  amount?: number;
  stockName?: string;
  basketName?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: NotificationMetadata | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface NotificationsPageResponse {
  notifications: Notification[];
  pagination: NotificationsPagination;
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await stocksApi.get("/notifications/unread-count");
  return response.data?.count ?? 0;
}

export async function fetchRecentNotifications(
  limit: number = 5,
): Promise<Notification[]> {
  const response = await stocksApi.get("/notifications/recent", {
    params: { limit },
  });

  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchNotificationsPage(
  page: number = 1,
  limit: number = 20,
): Promise<NotificationsPageResponse> {
  const response = await stocksApi.get("/notifications", {
    params: { page, limit },
  });

  const data = response.data as Partial<NotificationsPageResponse> | undefined;

  return {
    notifications: Array.isArray(data?.notifications) ? data!.notifications : [],
    pagination: {
      page: data?.pagination?.page ?? page,
      limit: data?.pagination?.limit ?? limit,
      total: data?.pagination?.total ?? 0,
      hasMore: data?.pagination?.hasMore ?? false,
    },
  };
}

export async function markAsRead(notificationId: string): Promise<void> {
  await stocksApi.post(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await stocksApi.post("/notifications/mark-all-read");
}

export async function clearAllNotifications(): Promise<void> {
  await stocksApi.post("/notifications/clear-all");
}

/**
 * Formats notification title & message to ensure human-readable order numbers
 * and correct spelling (e.g., replaces CUIDs like #cms4h6t... with #ORD-...)
 */
export function formatNotificationDisplay(notification: Notification): {
  title: string;
  message: string;
} {
  let title = notification.title;
  let message = notification.message;

  // Fix title typos
  if (title === "Order Recieve Successfully") {
    title = "Order Received Successfully";
  }

  // Sanitize raw CUID database IDs in message (e.g. #c... with 20+ chars)
  if (message.includes("#c")) {
    const orderNumFromMeta =
      (notification.metadata?.orderNumber as string) ||
      (notification.metadata?.orderId as string);

    message = message.replace(/#c[a-z0-9]{20,}/gi, (match) => {
      const cuid = match.substring(1);
      if (orderNumFromMeta && !orderNumFromMeta.startsWith("c")) {
        return `#${orderNumFromMeta}`;
      }
      return `#ORD-${cuid.slice(-6).toUpperCase()}`;
    });
  }

  return { title, message };
}

/**
 * Resolves the destination URL for a notification click.
 * Honors explicit `metadata.redirectUrl` first, then falls back intelligently
 * based on metadata fields, notification type, title, and message content.
 */
export function getNotificationRedirectUrl(
  notification: Notification,
): string {
  const type = (notification.type || "").toUpperCase();

  // Demat notifications should open the user's profile, including older
  // notifications whose stored redirect URL points somewhere else.
  if (type.includes("DEMAT")) {
    return "/profile";
  }

  let meta: NotificationMetadata | null = notification.metadata;

  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = null;
    }
  }

  // 1. Explicit redirectUrl in metadata
  if (typeof meta?.redirectUrl === "string" && meta.redirectUrl.trim().length > 0) {
    return meta.redirectUrl.trim();
  }

  // 2. Order references in metadata
  const metaOrder = (meta?.orderNumber as string) || (meta?.orderId as string);
  if (metaOrder && typeof metaOrder === "string") {
    return `/orders/${metaOrder}`;
  }

  // 3. Basket references in metadata
  if (meta?.basketSlug && typeof meta.basketSlug === "string") {
    return `/baskets/${meta.basketSlug}`;
  }
  if (meta?.basketId && typeof meta.basketId === "string") {
    return `/baskets/${meta.basketId}`;
  }

  // 4. Stock references in metadata
  if (meta?.stockSlug && typeof meta.stockSlug === "string") {
    return `/stocks/${meta.stockSlug}`;
  }

  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();

  // 5. Demat related notifications (e.g., Application Rejected, Demat Linked)
  const isDemat =
    type.includes("DEMAT") ||
    title.includes("demat") ||
    message.includes("demat") ||
    title.includes("application rejected") ||
    title.includes("application approved") ||
    title.includes("application submitted");

  if (isDemat) {
    return "/demat";
  }

  // 6. KYC related notifications
  const isKyc =
    type.includes("KYC") ||
    title.includes("kyc") ||
    message.includes("kyc");

  if (isKyc) {
    if (
      title.includes("reject") ||
      message.includes("reject") ||
      type.includes("REJECT")
    ) {
      return "/kyc";
    }
    return "/dashboard";
  }

  // 7. Bank related notifications
  const isBank =
    type.includes("BANK") ||
    title.includes("bank") ||
    message.includes("bank");

  if (isBank) {
    return "/bank";
  }

  // 8. Order related notifications
  const isOrder =
    type.includes("ORDER") ||
    title.includes("order") ||
    message.includes("order");

  if (isOrder) {
    const orderMatch =
      message.match(/(?:#|\b)(ORD-[A-Za-z0-9]+)\b/i) ||
      title.match(/(?:#|\b)(ORD-[A-Za-z0-9]+)\b/i) ||
      message.match(/(?:#|\b)(c[a-z0-9]{20,})\b/i);

    if (orderMatch && orderMatch[1]) {
      return `/orders/${orderMatch[1]}`;
    }
    return "/dashboard/orders";
  }

  // 9. Security & Settings
  if (
    type.includes("SECURITY") ||
    type.includes("PASSWORD") ||
    title.includes("password") ||
    title.includes("security")
  ) {
    return "/settings";
  }

  // Default fallback
  return "/dashboard";
}
