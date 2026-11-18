import { stocksApi } from "./api-client";

export interface StockEntityDetails {
  name?: string;
  title?: string;
  slug?: string;
  category?: string;
  isin?: string | null;
  cin?: string | null;
  logoUrl?: string | null;
  currentPrice?: number | null;
  currentInternalLendingPrice?: number | null;
  currentExternalLendingPrice?: number | null;
  currentDiscountSlabs?: any[];
  currentIsActive?: boolean;
  [key: string]: any;
}

export interface ChangeDiffItem {
  field: string;
  label: string;
  currentValue: any;
  proposedValue: any;
  delta?: number | null;
  percentChange?: number | null;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export type ChangeRequestEntityType =
  | "STOCK"
  | "STOCK_PRICING"
  | "UPCOMING_STOCK"
  | "STOCK_CATEGORY"
  | "STATIC_PAGE"
  | "REVENUE_SHARING"
  | "FAQ"
  | "NEWS"
  | "ARTICLE"
  | "BASKET"
  | (string & {});

export interface ChangeRequest {
  id: string;
  entityType: ChangeRequestEntityType;
  entityId: string | null;
  entityName?: string;
  entityDetails?: StockEntityDetails | null;
  currentData?: any;
  proposedData: any;
  diff?: ChangeDiffItem[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedById: string;
  requestedBy: { id: string; fullName: string; email: string };
  reviewedById?: string | null;
  reviewedBy?: { id: string; fullName: string; email: string } | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getApprovalStats(): Promise<ApprovalStats> {
  try {
    const response = await stocksApi.get("/admin/approvals/stats");
    return response.data;
  } catch {
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }
}

export async function getPendingApprovals(): Promise<ChangeRequest[]> {
  try {
    const response = await stocksApi.get("/admin/approvals/pending");
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Unable to fetch pending approvals.");
  }
}

export async function getApprovalHistory(): Promise<ChangeRequest[]> {
  try {
    const response = await stocksApi.get("/admin/approvals/history");
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Unable to fetch approval history.");
  }
}

export async function approveRequest(id: string, reviewNote?: string): Promise<ChangeRequest> {
  try {
    const response = await stocksApi.post(`/admin/approvals/${id}/approve`, { reviewNote });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to approve request.");
  }
}

export async function rejectRequest(id: string, reviewNote?: string): Promise<ChangeRequest> {
  try {
    const response = await stocksApi.post(`/admin/approvals/${id}/reject`, { reviewNote });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to reject request.");
  }
}

export async function clearAllPendingRequests(action: 'REJECT' | 'DELETE' = 'REJECT', reviewNote?: string): Promise<{ count: number; action: string }> {
  try {
    const response = await stocksApi.post("/admin/approvals/clear-all", { action, reviewNote });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to clear pending requests.");
  }
}
