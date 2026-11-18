/**
 * Notification types and metadata used by the in-app notifications system.
 *
 * NOTE:
 * - `type` is persisted as a string in the database to keep the schema flexible.
 * - This enum provides a typed, centralized list of currently supported values.
 * - `metadata` is stored as JSON in Postgres and should stay extensible.
 */

export enum NotificationType {
  // Order-related (also triggers email elsewhere)
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // KYC-related (also triggers email elsewhere)
  KYC_VERIFIED = 'KYC_VERIFIED',
  KYC_REJECTED = 'KYC_REJECTED',

  // Demat-related (also triggers email elsewhere)
  DEMAT_LINKED = 'DEMAT_LINKED',

  // Basket-related (in-app only)
  BASKET_CREATED = 'BASKET_CREATED',

  // Future placeholders
  PRICE_ALERT = 'PRICE_ALERT',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE',
}

/**
 * Flexible JSON metadata stored alongside a notification.
 *
 * The frontend primarily relies on `redirectUrl` to navigate on click.
 * Additional fields enable richer UIs (e.g., order details, basket links).
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

  // Extensible for future requirements.
  [key: string]: unknown;
}
