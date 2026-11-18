/**
 * Stock API functions
 * Handles all stock-related API calls to the stocks-service backend
 */

import { stocksApi } from './api-client';

/**
 * Base64-encode HTML-rich fields in the DTO before sending over the wire.
 * This prevents external WAF/CDN proxies from blocking PUT/POST requests
 * that contain raw HTML tags (e.g. <table>, <tr>) in the JSON body.
 * The backend decodes before sanitizing with DOMPurify.
 */
function encodeHtmlFields(dto: Record<string, any>): Record<string, any> {
  const encoded = { ...dto };
  if (typeof encoded.companyOverview === 'string' && encoded.companyOverview) {
    encoded.companyOverview = btoa(unescape(encodeURIComponent(encoded.companyOverview)));
  }
  return encoded;
}
import type {
  Stock,
  CreateStockDto,
  UpdateStockDto,
  UpcomingStock,
  CreateUpcomingStockDto,
  UpdateUpcomingStockDto,
  UpcomingStockDocument,
  CreateUpcomingDocumentDto,
  UpdateUpcomingDocumentDto,
  StockDocument,
  CreateDocumentDto,
  UpdateDocumentDto
} from '@/types/stock';

export interface WatchlistStock {
  id: string;
  name: string;
  cin: string;
  price: number;
  description: string | null;
  logoUrl: string | null;
  totalShares: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  marketCap?: number | null;
}

export interface WatchlistEntry {
  addedAt: string;
  stock: WatchlistStock;
  upcomingStock?: WatchlistStock;
}

export interface ToggleWatchlistResponse {
  isInWatchlist: boolean;
}

function withUserIdHeader(userId?: string) {
  return userId ? { headers: { 'X-User-Id': userId } } : undefined;
}

/**
 * Fetch all active stocks from the backend
 * @returns Promise<Stock[]> Array of all active stocks
 * @throws Error with user-friendly message if request fails
 */
export async function getAllStocks(): Promise<Stock[]> {
  try {
    const response = await stocksApi.get('/stocks');
    return response.data;
  } catch (error: any) {
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stocks. Please check your connection.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load stocks. Please try again.');
  }
}

/**
 * Fetch single stock details by ID
 * @param id - Stock ID (CUID)
 * @returns Promise<Stock> Stock object with full details
 * @throws Error with user-friendly message if request fails
 */
export async function getStockById(id: string): Promise<Stock> {
  try {
    const response = await stocksApi.get(`/stocks/${id}`);
    return response.data;
  } catch (error: any) {
    // Log full error for debugging
    console.error('getStockById error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    // Not found errors (404)
    if (error.response?.status === 404) {
      throw new Error('Stock not found. It may have been removed or is no longer available.');
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stock details. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to load stock details. Please try again.');
  }
}

/**
 * Fetch the authenticated user's watchlist
 * Auth is handled via HttpOnly cookies (`withCredentials: true`).
 * Optionally attaches X-User-Id for correlation (NOT used for authentication).
 */
export async function getWatchlist(userIdForHeader?: string): Promise<WatchlistEntry[]> {
  try {
    const response = await stocksApi.get('/watchlist', withUserIdHeader(userIdForHeader));
    const entries = response.data as any[];

    // Backwards compatible mapping:
    // - Existing consumers read `entry.stock`.
    // - Upcoming-stock consumers can read `entry.upcomingStock`.
    return entries.map((entry) => {
      if (entry?.type === 'UPCOMING' && entry?.stock) {
        return {
          ...entry,
          upcomingStock: entry.stock,
        } as WatchlistEntry;
      }

      return entry as WatchlistEntry;
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to view your watchlist.');
    }

    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    }

    if (!error.response) {
      throw new Error('Failed to load watchlist. Please check your connection.');
    }

    throw new Error('Unable to load watchlist. Please try again.');
  }
}

/**
 * Toggle a stock in the authenticated user's watchlist
 * Auth is handled by the axios client (cookie-based session).
 * Optionally attaches X-User-Id for correlation (NOT used for authentication).
 */
export async function toggleWatchlist(
  stockId: string,
  userIdForHeader?: string,
  stockType?: 'regular' | 'upcoming'
): Promise<ToggleWatchlistResponse> {
  try {
    const routePrefix = stockType === 'upcoming' ? '/upcoming-stocks' : '/stocks';
    const response = await stocksApi.post(
      `${routePrefix}/${stockId}/watchlist`,
      undefined,
      withUserIdHeader(userIdForHeader)
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to manage your watchlist.');
    }

    if (error.response?.status === 404) {
      throw new Error('Stock not found.');
    }

    if (error.response?.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    }

    if (!error.response) {
      throw new Error('Failed to update watchlist. Please check your connection.');
    }

    throw new Error('Unable to update watchlist. Please try again.');
  }
}

// ============================================
// UPCOMING STOCK API FUNCTIONS
// ============================================

// --------------------------------------------
// Public Endpoints
// --------------------------------------------

export async function getAllUpcomingStocks(): Promise<UpcomingStock[]> {
  try {
    const response = await stocksApi.get('/upcoming-stocks');
    return response.data;
  } catch (error: any) {
    if (!error.response) {
      throw new Error('Failed to load upcoming stocks. Please check your connection.');
    }

    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    throw new Error('Unable to load upcoming stocks. Please try again.');
  }
}

export async function getUpcomingStockById(id: string): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.get(`/upcoming-stocks/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('getUpcomingStockById error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found. It may have been removed or is no longer available.');
    }

    if (!error.response) {
      throw new Error('Failed to load upcoming stock details. Please check your connection.');
    }

    throw new Error('Unable to load upcoming stock details. Please try again.');
  }
}

// --------------------------------------------
// Admin Endpoints
// --------------------------------------------

export async function getAllUpcomingStocksAdmin(): Promise<UpcomingStock[]> {
  try {
    const response = await stocksApi.get('/upcoming-stocks/admin/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access admin upcoming stocks:', error);
      return [];
    }

    if (!error.response) {
      throw new Error('Failed to load upcoming stocks. Please check your connection.');
    }

    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    throw new Error('Unable to load upcoming stocks. Please try again.');
  }
}

export async function createUpcomingStock(dto: CreateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;
    const response = await stocksApi.post('/upcoming-stocks/admin', payload);
    return response.data;
  } catch (error: any) {
    console.error('createUpcomingStock error:', error.response?.data || error.message);

    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to create upcoming stocks.");
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid upcoming stock data. Please check your input.';
      throw new Error(message);
    }

    if (!error.response) {
      throw new Error('Failed to create upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to create upcoming stock. Please try again.');
  }
}

export async function updateUpcomingStock(id: string, dto: UpdateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;
    const response = await stocksApi.put(`/upcoming-stocks/admin/${id}`, payload);
    return response.data;
  } catch (error: any) {
    console.error('updateUpcomingStock error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found. It may have been deleted.');
    }

    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update upcoming stocks.");
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid upcoming stock data. Please check your input.';
      throw new Error(message);
    }

    if (!error.response) {
      throw new Error('Failed to update upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to update upcoming stock. Please try again.');
  }
}

export async function deleteUpcomingStock(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/upcoming-stocks/admin/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('deleteUpcomingStock error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found or already deleted.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete upcoming stocks.");
    }

    if (!error.response) {
      throw new Error('Failed to delete upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to delete upcoming stock. Please try again.');
  }
}

export async function convertUpcomingToRegular(id: string): Promise<any> {
  try {
    const response = await stocksApi.post(`/upcoming-stocks/admin/${id}/convert`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to convert stocks.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to convert upcoming stocks.");
    }

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found.');
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Unable to convert upcoming stock.';
      throw new Error(message);
    }

    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    if (!error.response) {
      throw new Error('Failed to convert upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to convert upcoming stock. Please try again.');
  }
}

// --------------------------------------------
// CMS Endpoints
// --------------------------------------------

export async function getAllUpcomingStocksCms(): Promise<UpcomingStock[]> {
  try {
    const response = await stocksApi.get('/upcoming-stocks/cms/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access CMS upcoming stocks:', error);
      return [];
    }

    if (!error.response) {
      throw new Error('Failed to load upcoming stocks. Please check your connection.');
    }

    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    throw new Error('Unable to load upcoming stocks. Please try again.');
  }
}

export async function createUpcomingStockCms(dto: CreateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.post('/upcoming-stocks/cms', dto);
    return response.data;
  } catch (error: any) {
    console.error('createUpcomingStockCms error:', error.response?.data || error.message);

    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to create upcoming stocks.");
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid upcoming stock data. Please check your input.';
      throw new Error(message);
    }

    if (!error.response) {
      throw new Error('Failed to create upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to create upcoming stock. Please try again.');
  }
}

export async function updateUpcomingStockCms(id: string, dto: UpdateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.put(`/upcoming-stocks/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error('updateUpcomingStockCms error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found. It may have been deleted.');
    }

    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update upcoming stocks.");
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid upcoming stock data. Please check your input.';
      throw new Error(message);
    }

    if (!error.response) {
      throw new Error('Failed to update upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to update upcoming stock. Please try again.');
  }
}

export async function deleteUpcomingStockCms(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/upcoming-stocks/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('deleteUpcomingStockCms error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found or already deleted.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete upcoming stocks.");
    }

    if (!error.response) {
      throw new Error('Failed to delete upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to delete upcoming stock. Please try again.');
  }
}

export async function convertUpcomingToRegularCms(id: string): Promise<any> {
  try {
    const response = await stocksApi.post(`/upcoming-stocks/cms/${id}/convert`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to convert stocks.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to convert upcoming stocks.");
    }

    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found.');
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Unable to convert upcoming stock.';
      throw new Error(message);
    }

    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    if (!error.response) {
      throw new Error('Failed to convert upcoming stock. Please check your connection.');
    }

    throw new Error('Unable to convert upcoming stock. Please try again.');
  }
}

// --------------------------------------------
// Document Management (CMS)
// --------------------------------------------

export async function getUpcomingStockDocumentsCms(stockId: string): Promise<UpcomingStockDocument[]> {
  try {
    const response = await stocksApi.get(`/upcoming-stocks/cms/${stockId}/documents`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Upcoming stock not found.');
    }
    if (!error.response) {
      throw new Error('Failed to load documents. Please check your connection.');
    }
    throw new Error('Unable to load documents. Please try again.');
  }
}

export async function createUpcomingDocumentCms(
  stockId: string,
  dto: CreateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.post(`/upcoming-stocks/cms/${stockId}/documents`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data. Check required fields.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to add documents.");
    }
    if (!error.response) {
      throw new Error('Failed to create document. Please check your connection.');
    }
    throw new Error('Unable to create document. Please try again.');
  }
}

export async function updateUpcomingDocumentCms(
  stockId: string,
  documentId: string,
  dto: UpdateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.put(`/upcoming-stocks/cms/${stockId}/documents/${documentId}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Document not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update documents.");
    }
    if (!error.response) {
      throw new Error('Failed to update document. Please check your connection.');
    }
    throw new Error('Unable to update document. Please try again.');
  }
}

export async function deleteUpcomingDocumentCms(
  stockId: string,
  documentId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/upcoming-stocks/cms/${stockId}/documents/${documentId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Document not found or already deleted.');
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete documents.");
    }
    if (!error.response) {
      throw new Error('Failed to delete document. Please check your connection.');
    }
    throw new Error('Unable to delete document. Please try again.');
  }
}

// ============================================
// ADMIN STOCK CRUD FUNCTIONS
// ============================================

/**
 * Fetch all stocks including inactive ones (admin view)
 * Requires admin JWT authentication
 * @returns Promise<Stock[]> Array of all stocks (active + inactive)
 * @throws Error with user-friendly message if request fails
 */
export async function getAllStocksAdmin(): Promise<Stock[]> {
  try {
    const response = await stocksApi.get('/stocks/admin/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access admin stocks:', error);
      return [];
    }
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stocks. Please check your connection.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load stocks. Please try again.');
  }
}

/**
 * Fetch all stocks including inactive ones (CMS panel view)
 * Requires CMS JWT authentication and cms_stocks permission
 * @returns Promise<Stock[]> Array of all stocks (active + inactive)
 * @throws Error with user-friendly message if request fails
 */
export async function getAllStocksCms(): Promise<Stock[]> {
  try {
    const response = await stocksApi.get('/stocks/cms/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access CMS stocks:', error);
      return [];
    }
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stocks. Please check your connection.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load stocks. Please try again.');
  }
}

/**
 * Fetch all stocks including inactive ones (Accounting panel view)
 * Requires Accounting JWT authentication
 * @returns Promise<Stock[]> Array of all stocks (active + inactive)
 * @throws Error with user-friendly message if request fails
 */
export async function getAllStocksAccounting(): Promise<Stock[]> {
  try {
    const response = await stocksApi.get('/stocks/accounting/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access accounting stocks:', error);
      return [];
    }
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stocks. Please check your connection.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load stocks. Please try again.');
  }
}

/**
 * Fetch all stocks including inactive ones (Operation panel view)
 * Requires Operation JWT authentication
 * @returns Promise<Stock[]> Array of all stocks (active + inactive)
 * @throws Error with user-friendly message if request fails
 */
export async function getAllStocksOperation(): Promise<Stock[]> {
  try {
    const response = await stocksApi.get('/stocks/operation/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('No permission to access operation stocks:', error);
      return [];
    }
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load stocks. Please check your connection.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load stocks. Please try again.');
  }
}

/**
 * Create a new stock (admin only)
 * Requires admin JWT authentication and manage_stocks permission
 * @param dto - CreateStockDto with stock details
 * @returns Promise<Stock> Created stock object
 * @throws Error with user-friendly message if request fails
 */
export async function createStock(dto: CreateStockDto): Promise<Stock> {
  try {
    const response = await stocksApi.post('/stocks/admin', encodeHtmlFields(dto));
    return response.data;
  } catch (error: any) {
    console.error('createStock error:', error.response?.data || error.message);

    // Conflict errors (409) - CIN already exists
    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to create stocks.");
    }

    // Bad request (400) - validation errors
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid stock data. Please check your input.';
      throw new Error(message);
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to create stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to create stock. Please try again.');
  }
}

/**
 * Update an existing stock (admin only)
 * Requires admin JWT authentication and manage_stocks permission
 * @param id - Stock ID (CUID)
 * @param dto - UpdateStockDto with fields to update (all optional)
 * @returns Promise<Stock> Updated stock object
 * @throws Error with user-friendly message if request fails
 */
export async function updateStock(id: string, dto: UpdateStockDto): Promise<Stock> {
  try {
    const response = await stocksApi.put(`/stocks/admin/${id}`, encodeHtmlFields(dto));
    return response.data;
  } catch (error: any) {
    console.error('updateStock error:', error.response?.data || error.message);

    // Not found errors (404)
    if (error.response?.status === 404) {
      throw new Error('Stock not found. It may have been deleted.');
    }

    // Conflict errors (409) - immutable CIN or duplicate CIN
    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists or cannot be changed.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || "You don't have permission to update stocks.";
      throw new Error(message);
    }

    // Bad request (400) - validation errors
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid stock data. Please check your input.';
      throw new Error(message);
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to update stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to update stock. Please try again.');
  }
}

/**
 * Update an existing stock (operation panel)
 * Requires operation JWT authentication
 * @param id - Stock ID (CUID)
 * @param dto - UpdateStockDto with fields to update (all optional)
 * @returns Promise<Stock> Updated stock object
 * @throws Error with user-friendly message if request fails
 */
export async function updateStockOperation(id: string, dto: UpdateStockDto): Promise<Stock> {
  try {
    const response = await stocksApi.put(`/stocks/operation/${id}`, encodeHtmlFields(dto));
    return response.data;
  } catch (error: any) {
    console.error('updateStockOperation error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Stock not found. It may have been deleted.');
    }

    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists or cannot be changed.');
    }

    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update stocks. Only Super Admins can change names.");
    }

    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid stock data. Please check your input.';
      throw new Error(message);
    }

    if (!error.response) {
      throw new Error('Failed to update stock. Please check your connection.');
    }

    throw new Error('Unable to update stock. Please try again.');
  }
}

/**
 * Delete a stock (soft delete - sets isActive = false)
 * Requires admin JWT authentication and manage_stocks permission
 * @param id - Stock ID (CUID)
 * @returns Promise<{ success: boolean, message: string }> Deletion result
 * @throws Error with user-friendly message if request fails
 */
export async function deleteStock(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/stocks/admin/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('deleteStock error:', error.response?.data || error.message);

    // Not found errors (404)
    if (error.response?.status === 404) {
      throw new Error('Stock not found or already deleted.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete stocks.");
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to delete stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to delete stock. Please try again.');
  }
}

// ============================================
// CMS STOCK CRUD FUNCTIONS
// ============================================

/**
 * Create a new stock (CMS panel access)
 * Requires CMS JWT authentication and cms_stocks permission
 * @param dto - CreateStockDto with stock details
 * @returns Promise<Stock> Created stock object
 * @throws Error with user-friendly message if request fails
 */
export async function createStockCms(dto: CreateStockDto): Promise<Stock> {
  try {
    const response = await stocksApi.post('/stocks/cms', encodeHtmlFields(dto));
    return response.data;
  } catch (error: any) {
    console.error('createStockCms error:', error.response?.data || error.message);

    // Conflict errors (409) - CIN already exists
    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to create stocks.");
    }

    // Bad request (400) - validation errors
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid stock data. Please check your input.';
      throw new Error(message);
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to create stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to create stock. Please try again.');
  }
}

/**
 * Update an existing stock (CMS panel access)
 * Requires CMS JWT authentication and cms_stocks permission
 * @param id - Stock ID (CUID)
 * @param dto - UpdateStockDto with fields to update (all optional)
 * @returns Promise<Stock> Updated stock object
 * @throws Error with user-friendly message if request fails
 */
export async function updateStockCms(id: string, dto: UpdateStockDto): Promise<Stock> {
  try {
    const response = await stocksApi.put(`/stocks/cms/${id}`, encodeHtmlFields(dto));
    return response.data;
  } catch (error: any) {
    console.error('updateStockCms error:', error.response?.data || error.message);

    // Not found errors (404)
    if (error.response?.status === 404) {
      throw new Error('Stock not found. It may have been deleted.');
    }

    // Conflict errors (409) - CIN already exists
    if (error.response?.status === 409) {
      throw new Error('Stock CIN already exists. Please use a different CIN.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || "You don't have permission to update stocks.";
      throw new Error(message);
    }

    // Bad request (400) - validation errors
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid stock data. Please check your input.';
      throw new Error(message);
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to update stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to update stock. Please try again.');
  }
}

/**
 * Delete a stock (soft delete - sets isActive = false)
 * Requires CMS JWT authentication and cms_stocks permission
 * @param id - Stock ID (CUID)
 * @returns Promise<{ success: boolean, message: string }> Deletion result
 * @throws Error with user-friendly message if request fails
 */
export async function deleteStockCms(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/stocks/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('deleteStockCms error:', error.response?.data || error.message);

    // Not found errors (404)
    if (error.response?.status === 404) {
      throw new Error('Stock not found or already deleted.');
    }

    // Forbidden errors (403) - no permission
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete stocks.");
    }

    // Network errors
    if (!error.response) {
      throw new Error('Failed to delete stock. Please check your connection.');
    }

    // Generic error
    throw new Error('Unable to delete stock. Please try again.');
  }
}

// ============================================
// CMS STOCK DOCUMENTS CRUD FUNCTIONS
// ============================================

/**
 * Get all documents for a stock (CMS)
 * @param stockId - Stock ID
 * @returns Promise<StockDocument[]>
 */
export async function getStockDocumentsCms(stockId: string): Promise<StockDocument[]> {
  try {
    const response = await stocksApi.get(`/stocks/cms/${stockId}/documents`);
    return response.data;
  } catch (error: any) {
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
 * Create a new document for a stock (CMS)
 * @param stockId - Stock ID
 * @param dto - CreateDocumentDto
 * @returns Promise<StockDocument>
 */
export async function createDocumentCms(stockId: string, dto: CreateDocumentDto): Promise<StockDocument> {
  try {
    const response = await stocksApi.post(`/stocks/cms/${stockId}/documents`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data. Check required fields.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to add documents.");
    }
    if (!error.response) {
      throw new Error('Failed to create document. Please check your connection.');
    }
    throw new Error('Unable to create document. Please try again.');
  }
}

/**
 * Update a document (CMS)
 * @param stockId - Stock ID
 * @param documentId - Document ID
 * @param dto - UpdateDocumentDto
 * @returns Promise<StockDocument>
 */
export async function updateDocumentCms(stockId: string, documentId: string, dto: UpdateDocumentDto): Promise<StockDocument> {
  try {
    const response = await stocksApi.put(`/stocks/cms/${stockId}/documents/${documentId}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Document not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid document data.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update documents.");
    }
    if (!error.response) {
      throw new Error('Failed to update document. Please check your connection.');
    }
    throw new Error('Unable to update document. Please try again.');
  }
}

/**
 * Delete a document (CMS)
 * @param stockId - Stock ID
 * @param documentId - Document ID
 * @returns Promise<{ success: boolean; message: string }>
 */
export async function deleteDocumentCms(stockId: string, documentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete(`/stocks/cms/${stockId}/documents/${documentId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Document not found or already deleted.');
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete documents.");
    }
    if (!error.response) {
      throw new Error('Failed to delete document. Please check your connection.');
    }
    throw new Error('Unable to delete document. Please try again.');
  }
}

/**
 * Upload a document file
 * @param file - File to upload
 * @returns Promise<{ url: string; filename: string; originalName: string; mimetype: string; size: number }>
 */
export async function uploadDocument(file: File): Promise<{
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await stocksApi.post('/stocks/upload/document', formData, {
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

// Aliases for callers expecting these names
export const fetchUpcomingStocks = getAllUpcomingStocks;

// Aliases for callers expecting these names
export const fetchUpcomingStockById = getUpcomingStockById;

export interface CompanySyncStatus {
  active: boolean;
  total?: number;
  processed?: number;
  success?: number;
  failed?: number;
  currentCin?: string;
  currentName?: string;
  errors?: { cin: string; name: string; error: string }[];
  startedAt?: string;
  updatedAt?: string;
}

export async function startCompanySync(cins: string[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.post('/stocks/cms/company/sync', { cins });
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Unable to start data sync.';
    throw new Error(message);
  }
}

export async function getCompanySyncStatus(): Promise<CompanySyncStatus> {
  try {
    const response = await stocksApi.get('/stocks/cms/company/sync/status');
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Unable to fetch sync status.';
    throw new Error(message);
  }
}

export interface StockInterest {
  id: string;
  userId: string;
  stockId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  stock: {
    id: string;
    name: string;
    cin: string;
  };
}

export async function getStockInterestsAdmin(): Promise<StockInterest[]> {
  try {
    const response = await stocksApi.get('/stocks/admin/interests');
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Unable to fetch stock interests.';
    throw new Error(message);
  }
}