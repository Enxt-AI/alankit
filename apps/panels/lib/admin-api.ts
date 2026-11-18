/**
 * Admin-specific API utilities for delegated admin management.
 * This module handles admin management operations, allowing normal Admins with 'create_cms' permission
 * to manage Content Managers while Super Admins retain full access.
 *
 * For delegated access, 403 errors are handled gracefully by returning empty arrays
 * instead of throwing, enabling frontend empty states without crashes.
 *
 * Future enhancements: bulk operations, admin stats, etc.
 */

import { Admin } from '@/types/admin';
import { getAllAdmins as getAllAdminsFromAuthApi } from './auth-api';
import { authApi, stocksApi } from './api-client';
import type {
  StockDocument,
  CreateDocumentDto,
  UpdateDocumentDto,
  Stock,
} from '@/types/stock';
import type {
  StockBasket,
  BasketWithConstituents,
  CreateBasketDto,
  UpdateBasketDto,
} from '@/types/basket';

/**
 * Admin data returned by getAdminById endpoint
 * Minimal info for displaying agent details in tickets
 */
export interface AdminBasicInfo {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'SUPPORT_AGENT' | 'OPERATIONS' | 'ACCOUNTANT' | 'MARKETING_MANAGER';
  permissions: string[];
}

/**
 * Get all admins with delegated access control.
 * Handles 403 by returning empty array for normal Admins without full access,
 * enabling graceful degradation in the UI.
 *
 * @returns Promise<Admin[]> - Array of admins or empty array if access denied
 */
export async function getAllAdmins(): Promise<Admin[]> {
  try {
    const response = await getAllAdminsFromAuthApi();
    return response;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('Admin access denied: returning empty list for delegated view');
      return [];
    }
    // Re-throw other errors (network, server errors, etc.)
    throw error;
  }
}

/**
 * Get admin by ID
 * Endpoint: GET /auth/admin/:id
 * Public endpoint - no authentication required
 * Used for displaying agent information in ticket dialogs
 * @param adminId - Admin's unique ID
 * @returns Admin basic info or null if not found
 * @throws Error if network error or server error
 */
export async function getAdminById(adminId: string): Promise<AdminBasicInfo | null> {
  console.log('[Admin API] Fetching admin by ID:', adminId);
  try {
    const response = await authApi.get<AdminBasicInfo>(`/auth/admin/${adminId}`);
    console.log('[Admin API] Admin fetched:', response.data.email);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn('[Admin API] Admin not found (expected for user comments):', adminId);
      return null; // Return null instead of throwing
    }
    console.error('[Admin API] Error fetching admin:', error.message);
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to fetch admin information.');
  }
}

// ===== USER MANAGEMENT & KYC REVIEW =====

export interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  kycStatus: string;
  currentStep?: number;
  dematStatus: string;
  bankStatus?: string;
  panCardNumber?: string | null;
  panNumber?: string | null;
  dematData?: any;
  kycData?: any;
  createdAt: string;
  updatedAt: string;
}

export interface GetAllUsersFilters {
  kycStatus?: string;
  dematStatus?: string;
  bankStatus?: string;
  search?: string;
  /**
   * When true, return only users who have submitted KYC for review.
   * This is based on the explicit signal `kycData.submittedAt`.
   */
  submittedOnly?: boolean;
  bankSubmittedOnly?: boolean;
  dematSubmittedOnly?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Get all users with optional filters
 */
export async function getAllKycUsers(filters?: GetAllUsersFilters): Promise<AdminUser[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.kycStatus) params.append('kycStatus', filters.kycStatus);
    if (filters?.dematStatus) params.append('dematStatus', filters.dematStatus);
    if (filters?.bankStatus) params.append('bankStatus', filters.bankStatus);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.submittedOnly) params.append('submittedOnly', 'true');
    if (filters?.bankSubmittedOnly) params.append('bankSubmittedOnly', 'true');
    if (filters?.dematSubmittedOnly) params.append('dematSubmittedOnly', 'true');
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const queryString = params.toString();
    const url = `/auth/admin/users${queryString ? `?${queryString}` : ''}`;

    const response = await authApi.get<AdminUser[]>(url);
    return response.data;
  } catch (error: any) {
    console.error('Get all users error:', error);
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    throw new Error(error.response?.data?.message || 'Failed to fetch users');
  }
}

/**
 * Permanently delete a user and their data
 */
export async function permanentlyDeleteUser(userId: string): Promise<{ success: boolean; message: string; redisCleanupPending?: boolean }> {
  try {
    const response = await authApi.post(`/auth/admin/users/${userId}/delete`);
    return response.data;
  } catch (error: any) {
    console.error('Delete user error:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete user');
  }
}


/**
 * Get authentication mode status
 * Returns whether phone-first authentication is active
 * 
 * @returns Promise<{ phoneFirstAuthMode: boolean }>
 */
export async function getAuthModeStatus(): Promise<{
  phoneFirstAuthMode: boolean;
}> {
  try {
    const response = await authApi.get<{
      phoneFirstAuthMode: boolean;
    }>('/auth/system/auth-mode');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch auth mode status:', error);
    // Return true as phone-first is the default mode
    return {
      phoneFirstAuthMode: true,
    };
  }
}


// ============================================
// ADMIN STOCK DETAILS FUNCTIONS
// ============================================

/**
 * Get stock details for admin use (uses public endpoint with admin error handling)
 * @param stockId - Stock ID
 * @returns Promise<Stock>
 */
export async function getStockDetailsAdmin(stockId: string): Promise<Stock> {
  try {
    const response = await stocksApi.get(`/stocks/${stockId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Stock not found.');
    }
    if (!error.response) {
      throw new Error('Failed to load stock details. Please check your connection.');
    }
    throw new Error('Unable to load stock details. Please try again.');
  }
}

// ============================================
// ADMIN STOCK DOCUMENTS CRUD FUNCTIONS
// ============================================

/**
 * Get all documents for a stock (Admin)
 * @param stockId - Stock ID
 * @returns Promise<StockDocument[]>
 */
export async function getStockDocumentsAdmin(stockId: string): Promise<StockDocument[]> {
  try {
    const response = await stocksApi.get(`/stocks/admin/${stockId}/documents`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Stock not found.');
    }
    if (!error.response) {
      throw new Error('Failed to load documents. Please check your connection.');
    }
    throw new Error('Unable to load documents. Please try again.');
  }
}

/**
 * Get price history for a stock (Admin)
 */
export async function getStockPriceHistoryAdmin(stockId: string): Promise<any[]> {
  const response = await stocksApi.get(`/stocks/admin/${stockId}/prices`);
  return response.data;
}

/**
 * Add a price point for a stock (Admin)
 */
export async function addStockPriceAdmin(stockId: string, dto: any): Promise<any> {
  const response = await stocksApi.post(`/stocks/admin/${stockId}/prices`, dto);
  return response.data;
}

/**
 * Delete a price point (Admin)
 */
export async function deleteStockPriceAdmin(priceId: string): Promise<any> {
  const response = await stocksApi.delete(`/stocks/admin/prices/${priceId}`);
  return response.data;
}

/**
 * Create a new document for a stock (Admin)
 * @param stockId - Stock ID
 * @param dto - CreateDocumentDto
 * @returns Promise<StockDocument>
 */
export async function createDocumentAdmin(stockId: string, dto: CreateDocumentDto): Promise<StockDocument> {
  try {
    const response = await stocksApi.post(`/stocks/admin/${stockId}/documents`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data. Check required fields.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Failed to create document. Please check your connection.');
    }
    throw new Error('Unable to create document. Please try again.');
  }
}

/**
 * Update a document (Admin)
 * @param stockId - Stock ID
 * @param documentId - Document ID
 * @param dto - UpdateDocumentDto
 * @returns Promise<StockDocument>
 */
export async function updateDocumentAdmin(stockId: string, documentId: string, dto: UpdateDocumentDto): Promise<StockDocument> {
  try {
    const response = await stocksApi.put(`/stocks/admin/${stockId}/documents/${documentId}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Document not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Failed to update document. Please check your connection.');
    }
    throw new Error('Unable to update document. Please try again.');
  }
}

/**
 * Delete a document (Admin)
 * @param stockId - Stock ID
 * @param documentId - Document ID
 * @returns Promise<{ success: boolean; message: string }>
 */
export async function deleteDocumentAdmin(stockId: string, documentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/stocks/admin/${stockId}/documents/${documentId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Document not found or already deleted.');
    }
    if (!error.response) {
      throw new Error('Failed to delete document. Please check your connection.');
    }
    throw new Error('Unable to delete document. Please try again.');
  }
}

// ============================================
// ADMIN UPLOAD FUNCTIONS
// ============================================

/**
 * Upload a document file (Admin)
 * @param file - File to upload
 * @returns Promise<{ url: string; filename: string; originalName: string; mimetype: string; size: number }>
 */
export async function uploadDocumentAdmin(file: File): Promise<{
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await stocksApi.post('/stocks/admin/upload/document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid file. Check size and type requirements.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to upload files.");
    }
    if (!error.response) {
      throw new Error('Failed to upload document. Please check your connection.');
    }
    throw new Error('Unable to upload document. Please try again.');
  }
}

// ============================================
// ADMIN BASKET MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get all baskets for admin panel
 * @returns Promise<BasketWithConstituents[]> - Array of all baskets with constituents
 */
export async function getAllBasketsAdmin(): Promise<BasketWithConstituents[]> {
  try {
    const response = await stocksApi.get<BasketWithConstituents[]>('/baskets/admin/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later');
    }
    if (!error.response) {
      throw new Error('Failed to load baskets. Please check your connection.');
    }
    throw new Error('Unable to load baskets. Please try again.');
  }
}

/**
 * Create a new basket from admin panel
 * @param dto - Basket creation data
 * @returns Promise<StockBasket> - Created basket
 */
export async function createBasketAdmin(dto: CreateBasketDto): Promise<StockBasket> {
  try {
    const response = await stocksApi.post<StockBasket>('/baskets/admin', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 409) {
      throw new Error('Basket name already exists. Please use a different name.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid basket data. Check constituents weights sum to 100%.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Failed to create basket. Please check your connection.');
    }
    throw new Error('Unable to create basket. Please try again.');
  }
}

/**
 * Update an existing basket from admin panel
 * @param id - Basket ID
 * @param dto - Basket update data
 * @returns Promise<StockBasket> - Updated basket
 */
export async function updateBasketAdmin(id: string, dto: UpdateBasketDto): Promise<StockBasket> {
  try {
    const response = await stocksApi.put<StockBasket>(`/baskets/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Basket not found. It may have been deleted.');
    }
    if (error.response?.status === 409) {
      throw new Error('Basket name already exists. Please use a different name.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid basket data. Check your input.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Failed to update basket. Please check your connection.');
    }
    throw new Error('Unable to update basket. Please try again.');
  }
}

/**
 * Delete a basket from admin panel
 * @param id - Basket ID
 * @returns Promise<{ success: boolean; message: string }> - Deletion result
 */
export async function deleteBasketAdmin(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete<{ success: boolean; message: string }>(`/baskets/admin/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('Basket not found or already deleted.');
    }
    if (!error.response) {
      throw new Error('Failed to delete basket. Please check your connection.');
    }
    throw new Error('Unable to delete basket. Please try again.');
  }
}

/**
 * Approve user's Demat linking
 */
export async function approveUserDemat(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.put(`/demat/admin/${userId}/approve`);
    return response.data;
  } catch (error: any) {
    console.error('Approve Demat error:', error);
    throw new Error(error.response?.data?.message || 'Failed to approve Demat Account');
  }
}

/**
 * Reject user's Demat linking
 */
export async function rejectUserDemat(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.put(`/demat/admin/${userId}/reject`, { reason });
    return response.data;
  } catch (error: any) {
    console.error('Reject Demat error:', error);
    throw new Error(error.response?.data?.message || 'Failed to reject Demat Account');
  }
}

/**
 * Approve user's Bank linking
 */
export async function approveUserBank(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.put(`/bank/admin/${userId}/approve`);
    return response.data;
  } catch (error: any) {
    console.error('Approve Bank error:', error);
    throw new Error(error.response?.data?.message || 'Failed to approve Bank Account');
  }
}

/**
 * Reject user's Bank linking
 */
export async function rejectUserBank(userId: string, reason: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.put(`/bank/admin/${userId}/reject`, { reason });
    return response.data;
  } catch (error: any) {
    console.error('Reject Bank error:', error);
    throw new Error(error.response?.data?.message || 'Failed to reject Bank Account');
  }
}

/**
 * Get all audit logs for Super Admin
 */
export async function getAuditLogsAdmin(): Promise<any[]> {
  try {
    const response = await authApi.get('/auth/admin/audit-logs');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Super Admin access required');
    }
    throw new Error(error.response?.data?.message || 'Failed to fetch audit logs');
  }
}
