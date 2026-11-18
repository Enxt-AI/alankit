/**
 * Portfolio Types
 * 
 * TypeScript interfaces for portfolio data structures based on backend API response
 */

/**
 * Enriched stock information included in portfolio holdings
 */
export interface PortfolioStock {
  id: string;
  name: string;
  cin: string;
  price: number;
  logoUrl: string | null;
}

/**
 * Single portfolio holding with enriched data and P&L calculations
 * Combines Prisma Portfolio model with backend-calculated metrics
 */
export interface PortfolioItem {
  // Portfolio fields from Prisma model
  id: string;
  userId: string;
  stockId: string;
  quantity: number;
  avgPrice: number;
  createdAt: string;
  updatedAt: string;
  
  // Enriched fields calculated by backend
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  
  // Populated stock object (null if stock deleted)
  stock: PortfolioStock | null;
}

/**
 * Aggregated portfolio statistics
 * All calculations performed on backend
 */
export interface PortfolioSummary {
  totalCurrentValue: number;
  totalInvestedValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  totalHoldings: number;
}

/**
 * Complete portfolio API response structure
 */
export interface PortfolioResponse {
  holdings: PortfolioItem[];
  summary: PortfolioSummary;
}

/**
 * Structure for a single row in portfolio CSV export
 * Used for CSV generation and matches headers in csv-utils.ts
 */
export interface PortfolioCSVRow {
  CIN: string;
  'Stock Name': string;
  Quantity: number;
  'Avg Price (₹)': string;
  'Current Price (₹)': string;
  'Invested Value (₹)': string;
  'Current Value (₹)': string;
  'P&L (₹)': string;
  'P&L (%)': string;
}
