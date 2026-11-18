import { stocksApi } from "@/lib/api-client";
import type { PortfolioResponse } from "@/types/portfolio";

/**
 * Get My Portfolio API
 * 
 * Fetches logged-in user's portfolio with enriched data and P&L calculations
 * Uses stocksApi instance which includes JWT token interceptor
 */
export async function getMyPortfolio(): Promise<PortfolioResponse> {
  try {
    const response = await stocksApi.get<PortfolioResponse>("/portfolio");
    return response.data;
  } catch (error: any) {
    // Handle specific error codes
    if (error.response) {
      const status = error.response.status;
      
      // Fallback to status-based messages
      if (status === 401) {
        throw new Error("Please log in to view your portfolio");
      }
      
      if (status >= 500) {
        throw new Error("Server error. Please try again later");
      }
    }
    
    // Network errors
    if (error.request && !error.response) {
      throw new Error("Failed to load portfolio. Please check your connection.");
    }
    
    // Generic error
    throw new Error(
      error.message || "Unable to load portfolio. Please try again."
    );
  }
}
