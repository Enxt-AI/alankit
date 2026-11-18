/**
 * Admin Stats API Module
 *
 * Functions for fetching aggregated statistics from backend services
 * for the admin dashboard.
 *
 * AUDIENCE: System administrators
 * DATA SOURCE: Backend service endpoints (stocks-service, auth-service, etc.)
 * PURPOSE: System-wide overview and monitoring across all services
 */

import { authApi, stocksApi } from './api-client';
import type { StocksServiceStats, AuthServiceStats, MarketingStats } from '@/types/stats';

/**
 * Fetch statistics from stocks-service
 * Includes counts for stocks, orders, and referrals
 * 
 * @returns Promise<StocksServiceStats>
 * @throws Error with user-friendly message on failure
 */
export async function getStocksServiceStats(): Promise<StocksServiceStats> {
  try {
    const response = await stocksApi.get('/stats/admin/overview');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch stocks service stats:', error);
    throw new Error('Failed to fetch statistics. Please try again.');
  }
}

/**
 * Fetch statistics from auth-service
 * Includes counts for users and admins
 * 
 * @returns Promise<AuthServiceStats>
 * @throws Error with user-friendly message on failure
 */
export async function getAuthServiceStats(): Promise<AuthServiceStats> {
  try {
    const response = await authApi.get('/auth/admin/stats');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch auth service stats:', error);
    throw new Error('Failed to fetch statistics. Please try again.');
  }
}

/**
 * Fetch marketing statistics for admin dashboard
 * Includes lead counts, conversion rate, and campaign performance
 * 
 * @returns Promise<MarketingStats>
 * @throws Error with user-friendly message on failure
 */
export async function getMarketingStats(): Promise<MarketingStats> {
  try {
    const response = await stocksApi.get('/marketing/admin/stats');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch marketing statistics:', error);
    throw new Error('Failed to fetch marketing statistics. Please try again.');
  }
}
