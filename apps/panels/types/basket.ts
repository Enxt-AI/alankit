/**
 * Basket Types
 * Type definitions for stock baskets and related entities
 * Corresponds to Prisma models: StockBasket, BasketConstituent
 */

// ============================================
// ENUMS
// ============================================

/**
 * Basket Status Enum
 * Represents the lifecycle state of a stock basket
 * Matches backend BasketStatus enum and Prisma schema
 */
export enum BasketStatus {
  /** Basket is in draft mode, not visible to public */
  DRAFT = 'DRAFT',
  /** Basket is open for subscriptions */
  OPEN = 'OPEN',
  /** Basket is closed, no longer accepting subscriptions */
  CLOSED = 'CLOSED',
  /** Basket is scheduled to open in the future */
  COMING_SOON = 'COMING_SOON',
}

// ============================================
// BASE INTERFACES
// ============================================

/**
 * Basket Constituent
 * Represents a stock within a basket with its weight allocation
 * Corresponds to Prisma BasketConstituent model
 */
export interface BasketConstituent {
  /** Unique identifier */
  id: string;
  /** ID of the parent basket */
  basketId: string;
  /** ID of the stock in this basket */
  stockId: string;
  /** Weight percentage allocation (0-100) */
  weight: number;
  /** Creation timestamp (ISO 8601 format) */
  createdAt: string;
}

/**
 * Stock Basket
 * Represents a curated collection of stocks
 * Corresponds to Prisma StockBasket model
 */
export interface StockBasket {
  /** Unique identifier */
  id: string;
  /** Basket display name */
  name: string;
  /** URL-friendly slug generated from name */
  slug: string;
  /** Detailed description (nullable) */
  description: string | null;
  /** Category for grouping baskets */
  category: string;
  /** URL to basket icon/image (nullable) */
  iconUrl: string | null;
  /** Current status of the basket */
  status: BasketStatus;
  /** Subscription start date (ISO 8601 format, nullable) */
  subscriptionStartDate: string | null;
  /** Subscription end date (ISO 8601 format, nullable) */
  subscriptionEndDate: string | null;
  /** Minimum investment amount required */
  minInvestment: number;
  /** Date when price becomes effective (ISO 8601 format) */
  priceEffectiveDate: string;
  /** Whether basket is active and visible */
  isActive: boolean;
  /** ID of admin who created the basket */
  createdById: string;
  /** ID of admin who last updated the basket (nullable) */
  updatedById: string | null;
  /** Creation timestamp (ISO 8601 format) */
  createdAt: string;
  /** Last update timestamp (ISO 8601 format) */
  updatedAt: string;
}

// ============================================
// DTO INTERFACES (CMS Operations)
// ============================================

/**
 * Basket Constituent DTO
 * Used for creating/updating basket constituents
 * Corresponds to backend BasketConstituentDto
 */
export interface BasketConstituentDto {
  /** ID of the stock to include */
  stockId: string;
  /** Weight percentage allocation (0-100) */
  weight: number;
}

/**
 * Create Basket DTO
 * Data required to create a new basket
 * Corresponds to backend CreateBasketDto
 * Note: Constituent weights must sum to exactly 100%
 */
export interface CreateBasketDto {
  /** Basket display name (required) */
  name: string;
  /** Category for grouping (required) */
  category: string;
  /** Minimum investment amount (required) */
  minInvestment: number;
  /** Array of constituent stocks with weights (required) */
  constituents: BasketConstituentDto[];
  /** Detailed description (optional) */
  description?: string;
  /** URL to basket icon/image (optional) */
  iconUrl?: string;
  /** Initial status (optional, defaults to DRAFT) */
  status?: BasketStatus;
  /** Subscription start date (ISO 8601 format, optional) */
  subscriptionStartDate?: string;
  /** Subscription end date (ISO 8601 format, optional) */
  subscriptionEndDate?: string;
  /** Price effective date (ISO 8601 format, optional) */
  priceEffectiveDate?: string;
  /** Whether basket is active (optional, defaults to true) */
  isActive?: boolean;
}

/**
 * Update Basket DTO
 * Data for updating an existing basket
 * All fields are optional (partial update)
 * Corresponds to backend UpdateBasketDto
 */
export interface UpdateBasketDto {
  /** Basket display name */
  name?: string;
  /** Category for grouping */
  category?: string;
  /** Minimum investment amount */
  minInvestment?: number;
  /** Array of constituent stocks with weights (replaces all existing) */
  constituents?: BasketConstituentDto[];
  /** Detailed description */
  description?: string;
  /** URL to basket icon/image */
  iconUrl?: string;
  /** Status */
  status?: BasketStatus;
  /** Subscription start date (ISO 8601 format) */
  subscriptionStartDate?: string;
  /** Subscription end date (ISO 8601 format) */
  subscriptionEndDate?: string;
  /** Price effective date (ISO 8601 format) */
  priceEffectiveDate?: string;
  /** Whether basket is active */
  isActive?: boolean;
}

// ============================================
// EXTENDED INTERFACES (API Responses)
// ============================================

/**
 * Basket Constituent with Populated Stock
 * Constituent with nested stock details
 * Returned by backend service queries with stock relations
 * Note: Some fields are optional as different endpoints return different levels of detail
 * - getAllActiveBasketsPublic: includes only id, name, price
 * - getBasketById: may include additional fields like logoUrl, isin, cin
 */
export interface BasketConstituentWithStock extends BasketConstituent {
  /** Nested stock details */
  stock: {
    /** Stock ID */
    id: string;
    /** Stock display name */
    name: string;
    /** Current stock price */
    price: number;
    /** URL to stock logo (optional - not included in list views) */
    logoUrl?: string | null;
    /** ISIN code (optional - not included in list views) */
    isin?: string | null;
    /** CIN (Corporate Identification Number) -- optional, not included in list views */
    cin?: string | null;
  };
}

/**
 * Basket with Constituents
 * Complete basket with populated constituents and calculated fields
 * Returned by getAllActiveBasketsPublic and getBasketById endpoints
 */
export interface BasketWithConstituents extends StockBasket {
  /** Array of constituents with stock details */
  constituents: BasketConstituentWithStock[];
  /**
   * Calculated current price of the basket
   * Formula: Sum of (stock.price × constituent.weight / 100)
   * Computed by backend service
   */
  currentPrice: number;
  /**
   * Resolved status based on dates and manual overrides
   * Logic: Manual status takes precedence, otherwise date-based automation
   * - If status is explicitly set (DRAFT/OPEN/CLOSED/COMING_SOON): use it
   * - If dates are missing/invalid: fallback to status field
   * - If current date < subscriptionStartDate: COMING_SOON
   * - If current date > subscriptionEndDate: CLOSED
   * - Otherwise: OPEN
   */
  resolvedStatus: BasketStatus;
}

/**
 * Basket List Item
 * Simplified basket data for listing/card views
 * Optimized for rendering in basket galleries and selection interfaces
 */
export interface BasketListItem {
  /** Unique identifier */
  id: string;
  /** Basket display name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Category for grouping */
  category: string;
  /** URL to basket icon/image (nullable) */
  iconUrl: string | null;
  /** Resolved status */
  status: BasketStatus;
  /** Calculated current price */
  currentPrice: number;
  /** Number of constituent stocks */
  constituentCount: number;
}
