/**
 * Stock-related TypeScript types matching the Prisma Stock model
 * from packages/db-unlistedstock/prisma/schema.prisma
 */

/** A single row in the slab pricing table. */
export interface DiscountSlab {
  minAmount: number; // Minimum amount (inclusive) for this slab to apply
  pricePerShare: number; // Effective price per share when slab matches
}

export interface StockCategory {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stock {
  id: string; // CUID
  name: string; // Company name
  slug?: string | null; // URL slug
  description?: string | null; // Company overview / description (rich text)
  companyOverview?: string | null; // Detailed company information for SEO and UI
  price: number; // Current price per share

  minimumPurchaseQuantity?: number | null;
  maximumPurchaseQuantity?: number | null;
  logoUrl: string | null; // Optional logo URL
  internalLendingPrice?: number | null; // Floor price for  RMs
  externalLendingPrice?: number | null; // Floor price for Distributor RMs
  tags: string[]; // Array of tags for categorization (always present, possibly empty)
  categoryId?: string | null; // Relation to StockCategory
  category?: StockCategory | null; // Populated relation
  isin: string | null; // ISIN code (International Securities Identification Number)
  cin: string | null; // CIN (Corporate Identification Number) -- unique when present
  pan?: string | null; // Company PAN number
  isActive: boolean; // Whether stock is available for trading
  isPopular: boolean; // Whether stock is featured as popular
  isMarketMover: boolean; // Whether stock should appear in the Market Movers category
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  totalShares?: number | null;
  stockQuantity?: number;
  backupQuantity?: number;
  openingQuantity?: number;
  openingRate?: number;
  openingValue?: number;
  /** Slab pricing rules — optional, set by admin in CMS */
  discountSlabs?: DiscountSlab[] | null;
  marketCap?: number | null; // Calculated on backend
  documents?: StockDocument[];
  change?: number | null; // Daily price change
  changePercent?: number | null; // Daily price change percentage
  // Financial metrics (optional, populated by frontend or future backend updates)
  faceValue?: number | null;
  eps?: number | null;
  peRatio?: number | null;
  pbRatio?: number | null;
  bookValue?: number | null;
  debtToEquity?: number | null;
  dividendYield?: number | null;
  prices?: StockPrice[];
}

export interface StockPrice {
  id: string;
  stockId: string;
  price: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockPriceDto {
  price: number;
  date: string;
}

export interface StockDocument {
  id: string;
  stockId: string;
  name: string;
  url: string;
  type: "ANNUAL" | "QUARTERLY" | "RESEARCH";
  uploadedAt: string;
  updatedAt: string;
}

/**
 * DTO for creating a new stock (admin only)
 * Matches backend CreateStockDto
 */
export interface CreateStockDto {
  name: string;
  slug?: string;
  price: number;

  minimumPurchaseQuantity?: number | null;
  maximumPurchaseQuantity?: number | null;
  logoUrl?: string;
  tags?: string[]; // Array of tags for categorization
  categoryId?: string | null; // Relation to StockCategory
  isin?: string; // ISIN code (International Securities Identification Number)
  cin: string; // CIN (Corporate Identification Number)
  pan?: string; // Company PAN number
  companyOverview?: string; // Detailed company information for SEO and UI
  isActive?: boolean;
  isPopular?: boolean;
  isMarketMover?: boolean;
  totalShares?: number;
  openingQuantity?: number;
  openingRate?: number;
  openingValue?: number;
  backupQuantity?: number;
}

/**
 * DTO for updating an existing stock (admin only)
 * All fields are optional (allows partial updates)
 * Matches backend UpdateStockDto
 */
export interface UpdateStockDto {
  name?: string;
  slug?: string;
  price?: number;

  minimumPurchaseQuantity?: number | null;
  maximumPurchaseQuantity?: number | null;
  logoUrl?: string;
  tags?: string[]; // Array of tags for categorization
  categoryId?: string | null; // Relation to StockCategory
  isin?: string; // ISIN code (International Securities Identification Number)
  pan?: string; // Company PAN number
  companyOverview?: string; // Detailed company information for SEO and UI
  isActive?: boolean;
  internalLendingPrice?: number | null;
  externalLendingPrice?: number | null;
  isPopular?: boolean;
  isMarketMover?: boolean;
  totalShares?: number;
  openingQuantity?: number;
  openingRate?: number;
  openingValue?: number;
  backupQuantity?: number;
  discountSlabs?: DiscountSlab[] | null;
}

/**
 * DTOs for document management
 */
export interface CreateDocumentDto {
  name: string;
  url: string;
  type: "ANNUAL" | "QUARTERLY" | "RESEARCH";
}

export interface UpdateDocumentDto {
  name?: string;
  url?: string;
  type?: "ANNUAL" | "QUARTERLY" | "RESEARCH";
}

/**
 * Upcoming Stock types
 */

export interface UpcomingStock {
  id: string; // CUID
  name: string; // Company name
  slug?: string | null; // URL slug
  description?: string | null; // Company overview / description (rich text)
  companyOverview?: string | null; // Detailed company information for SEO and UI
  price: number; // Current price per share

  logoUrl: string | null; // Optional logo URL
  tags: string[]; // Array of tags for categorization (always present, possibly empty)
  isin: string | null; // ISIN code (International Securities Identification Number)
  cin: string; // CIN (Corporate Identification Number) -- immutable business identifier
  isActive: boolean; // Whether stock is available for trading
  isPopular: boolean; // Whether stock is featured as popular
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  totalShares?: number | null;
  marketCap?: number | null; // Calculated on backend
  documents?: UpcomingStockDocument[];
  change?: number | null; // Daily price change
  changePercent?: number | null; // Daily price change percentage
  // Financial metrics (optional, populated by frontend or future backend updates)
  faceValue?: number | null;
  eps?: number | null;
  peRatio?: number | null;
  pbRatio?: number | null;
  bookValue?: number | null;
  debtToEquity?: number | null;
  dividendYield?: number | null;
}

export interface UpcomingStockDocument {
  id: string;
  upcomingStockId: string;
  name: string;
  url: string;
  type: "ANNUAL" | "QUARTERLY" | "RESEARCH";
  uploadedAt: string;
  updatedAt: string;
}

export interface CreateUpcomingStockDto {
  name: string;
  price: number;

  logoUrl?: string;
  tags?: string[]; // Array of tags for categorization
  isin?: string; // ISIN code (International Securities Identification Number)
  cin: string; // CIN (Corporate Identification Number)
  companyOverview?: string; // Detailed company information for SEO and UI
  isActive?: boolean;
  totalShares?: number;
}

export interface UpdateUpcomingStockDto {
  price?: number;

  logoUrl?: string;
  tags?: string[]; // Array of tags for categorization (always present, possibly empty)
  isin?: string; // ISIN code (International Securities Identification Number)
  companyOverview?: string; // Detailed company information for SEO and UI
  isActive?: boolean;
  totalShares?: number;
}

export interface CreateUpcomingDocumentDto {
  name: string;
  url: string;
  type: "ANNUAL" | "QUARTERLY" | "RESEARCH";
}

export interface UpdateUpcomingDocumentDto {
  name?: string;
  url?: string;
  type?: "ANNUAL" | "QUARTERLY" | "RESEARCH";
}
