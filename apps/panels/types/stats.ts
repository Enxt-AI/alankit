/**
 * TypeScript types for admin dashboard statistics
 */

/**
 * Statistics from stocks-service
 * Includes counts for stocks, orders, and referrals
 */
export interface StocksServiceStats {
  /** Total number of stocks in the system */
  activeStocks: number;
  
  /** Number of active stocks (isActive = true) */
  totalStocks: number;
  
  /** Total number of orders */
  totalOrders: number;
  
  /** Number of pending orders (status = 'PENDING') */
  pendingOrders: number;
  
  // NOTE: totalReferrals and pendingReferrals fields removed as part of referral system deprecation.
}

/**
 * Statistics from auth-service
 * Includes counts for users and admins
 */
export interface AuthServiceStats {
  /** Total number of users in the system */
  totalUsers: number;
  
  /** Number of verified users (currentStep >= 2) */
  verifiedUsers: number;
  
  /** Number of users with pending KYC (kycStatus = 'PENDING') */
  pendingKycUsers: number;
  
  /** Total number of admin accounts */
  totalAdmins: number;
  
  /** Number of active admin accounts */
  activeAdmins: number;
}

/**
 * Marketing statistics for admin dashboard
 * Includes lead counts, conversion metrics, and campaign performance
 */
export interface MarketingStats {
  /** Total number of marketing leads */
  totalLeads: number;
  
  /** Number of converted leads (status = 'CONVERTED') */
  convertedLeads: number;
  
  /** Lead conversion rate as percentage (0-100) */
  conversionRate: number;
  
  /** Lead counts grouped by source/platform */
  leadsBySource: Array<{
    source: string;
    count: number;
  }>;
  
  /** Top 5 performing campaigns by lead count */
  topCampaigns: Array<{
    id: string;
    name: string;
    platform: string;
    leadCount: number;
  }>;
}
