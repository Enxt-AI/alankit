import { stocksApi } from './api-client';
import { stripBasePath } from './base-path';

export interface CouponUser {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CouponOrder {
  id: string;
  orderNumber?: string;
  quantity?: number;
  pricePerShare?: number;
  totalAmount?: number;
  originalTotalAmount?: number;
  discountApplied?: number;
  status?: string;
  createdAt?: string;
  user?: CouponUser | null;
  stock?: { id?: string; name: string; price?: number } | null;
}

export interface CouponStats {
  totalRedemptions: number;
  allOrdersCount: number;
  uniqueUsersCount: number;
  uniqueUsers?: CouponUser[];
  totalSharesSold: number;
  totalGrossRevenue: number;
  totalDiscountDisbursed: number;
  totalNetSales: number;
  avgSharesPerOrder: number;
  avgOrderValue: number;
}

export interface CouponCreator {
  id?: string;
  name: string;
  email?: string;
  role: string;
  type: 'ADMIN' | 'RM' | 'DISTRIBUTOR_RM';
  createdAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  stockId: string;
  stock?: {
    id?: string;
    name: string;
    price: number;
    minimumPurchaseQuantity?: number | null;
    internalLendingPrice?: number | null;
    externalLendingPrice?: number | null;
  } | null;
  minQuantity: number;
  maxQuantity: number;
  discountAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountPercentage?: number | null;
  isUsed: boolean;
  usedAt?: string | null;
  assignedUserId?: string | null;
  assignedUser?: CouponUser | null;
  usedByUserId?: string | null;
  usedByUser?: CouponUser | null;
  orderId?: string | null;
  order?: CouponOrder | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  internalRmId?: string | null;
  distributorRmId?: string | null;
  rmName?: string | null;
  rmEmail?: string | null;
  relationshipManager?: {
    id?: string;
    name?: string;
    email?: string;
    branch?: { id?: string; name?: string } | null;
    distributor?: { id?: string; name?: string } | null;
  } | null;
  redemptionCount?: number;
  orders?: CouponOrder[];
  stats?: CouponStats;
  isDirectAdmin?: boolean;
  createdBy?: CouponCreator | null;
  redemptionType?: 'ONCE' | 'UNLIMITED';
  isRedeemed?: boolean;
  mapToMarketing?: boolean;
}

export interface CreateCouponPayload {
  stockId: string;
  minQuantity: number;
  maxQuantity: number;
  discountAmount: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountPercentage?: number;
  code?: string;
  assignedUserId?: string;
  expiresAt?: string;
  redemptionType?: 'ONCE' | 'UNLIMITED';
  mapToMarketing?: boolean;
}

export interface CouponStock {
  id: string;
  name: string;
  price: number;
  minimumPurchaseQuantity?: number | null;
  lendingPrice?: number | null;
}

/**
 * Fetch all Admin promotional coupons across the platform.
 * Strictly excludes RM/distributor/branch coupons.
 * If requested for the Marketing panel, only returns coupons mapped to marketing.
 */
export async function getAllCoupons(panelContext?: string): Promise<Coupon[]> {
  const isMarketing =
    panelContext === 'marketing' ||
    (typeof window !== 'undefined' && stripBasePath(window.location.pathname).startsWith('/marketing'));
  const url = isMarketing
    ? '/stocks/coupons?scope=admin&adminOnly=true&panel=marketing'
    : '/stocks/coupons?scope=admin&adminOnly=true';
  const response = await stocksApi.get(url);
  const data = response.data;
  const list: Coupon[] = Array.isArray(data) ? data : data.coupons || [];
  const adminCoupons = list.filter((c) => !c.internalRmId && !c.distributorRmId && !!c.createdBy);
  if (isMarketing) {
    return adminCoupons.filter((c) => c.mapToMarketing === true);
  }
  return adminCoupons;
}

/**
 * Fetch a single coupon by ID (or code) with full sales & redemption analytics
 */
export async function getCouponById(id: string): Promise<Coupon> {
  const response = await stocksApi.get(`/stocks/coupons/${id}`);
  return response.data;
}

/**
 * Toggle whether a coupon is mapped to the marketing panel
 */
export async function toggleCouponMarketingMapping(id: string, mapToMarketing: boolean): Promise<Coupon> {
  const response = await stocksApi.patch(`/stocks/coupons/${id}/marketing-mapping`, { mapToMarketing });
  return response.data;
}

/**
 * Create a new promotional coupon as an administrator
 */
export async function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  const response = await stocksApi.post('/stocks/coupons', payload);
  return response.data;
}

/**
 * Delete an unredeemed coupon (only unredeemed coupons can be deleted)
 */
export async function deleteCoupon(id: string): Promise<void> {
  await stocksApi.delete(`/stocks/coupons/${id}`);
}

/**
 * Fetch all active stocks available for promotional coupon assignment
 */
export async function fetchCouponStocks(): Promise<CouponStock[]> {
  const response = await stocksApi.get('/stocks/rm/all');
  const data = response.data;
  return Array.isArray(data) ? data : [];
}

