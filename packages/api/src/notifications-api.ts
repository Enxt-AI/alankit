import { stocksApi } from "./api-client";

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
