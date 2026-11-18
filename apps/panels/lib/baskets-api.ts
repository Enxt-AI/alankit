/**
 * Basket API functions - Handles all basket-related API calls to the stocks-service backend
 */

import { stocksApi } from './api-client';
import type {
  StockBasket,
  BasketWithConstituents,
  CreateBasketDto,
  UpdateBasketDto,
} from '@/types/basket';

/**
 * Format a backend 400 payload into a human-readable message.
 * Backend returns { message: 'Validation failed', errors: [{ field, message }] }.
 */
function formatValidationMessage(data: any, fallback: string): string {
  const errors = data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors
      .map((e: any) =>
        typeof e === 'string' ? e : e?.field ? `${e.field}: ${e.message || 'invalid'}` : e?.message,
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join('; ');
  }
  const message = data?.message;
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string' && message !== 'Validation failed') return message;
  if (typeof message === 'string' && Array.isArray(errors) && errors.length === 0) return message;
  return fallback;
}

/**
 * Fetch all active baskets with constituents and calculated prices
 * Public endpoint - no authentication required
 * 
 * @returns Promise<BasketWithConstituents[]> Array of active baskets
 * @throws Error with user-friendly message
 */
export async function getAllBaskets(): Promise<BasketWithConstituents[]> {
  try {
    const response = await stocksApi.get<BasketWithConstituents[]>('/baskets');
    return response.data;
  } catch (error: any) {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to load baskets. Please check your connection.');
    }
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error('Unable to load baskets. Please try again.');
  }
}

/**
 * Fetch single basket by ID with full details
 * Public endpoint - no authentication required
 * 
 * @param id - Basket ID
 * @returns Promise<BasketWithConstituents> Basket details with constituents
 * @throws Error with user-friendly message
 */
export async function getBasketById(id: string): Promise<BasketWithConstituents> {
  try {
    const response = await stocksApi.get<BasketWithConstituents>(`/baskets/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching basket:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    if (error.response?.status === 404) {
      throw new Error('Basket not found. It may have been removed or is no longer available.');
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to load basket details. Please check your connection.');
    }
    throw new Error('Unable to load basket details. Please try again.');
  }
}

/**
 * Fetch all baskets including inactive ones (CMS endpoint)
 * Requires authentication and cms_baskets permission
 * 
 * @returns Promise<BasketWithConstituents[]> Array of all baskets
 * @throws Error with user-friendly message, returns empty array on 403
 */
export async function getAllBasketsCms(): Promise<BasketWithConstituents[]> {
  try {
    const response = await stocksApi.get<BasketWithConstituents[]>('/baskets/cms/all');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      console.warn('User does not have permission to access CMS baskets');
      return [];
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to load baskets. Please check your connection.');
    }
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error('Unable to load baskets. Please try again.');
  }
}

/**
 * Create a new basket (CMS endpoint)
 * Requires authentication and cms_baskets permission
 * 
 * @param dto - Basket creation data
 * @returns Promise<StockBasket> Created basket
 * @throws Error with user-friendly message
 */
export async function createBasketCms(dto: CreateBasketDto): Promise<StockBasket> {
  try {
    const response = await stocksApi.post<StockBasket>('/baskets/cms', dto);
    return response.data;
  } catch (error: any) {
    console.error('Error creating basket:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    if (error.response?.status === 409) {
      throw new Error('Basket name already exists. Please use a different name.');
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to create baskets.");
    }
    if (error.response?.status === 400) {
      throw new Error(
        formatValidationMessage(error.response?.data, 'Invalid basket data. Please check your input.'),
      );
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to create basket. Please check your connection.');
    }
    throw new Error('Unable to create basket. Please try again.');
  }
}

/**
 * Update an existing basket (CMS endpoint)
 * Requires authentication and cms_baskets permission
 * 
 * @param id - Basket ID
 * @param dto - Basket update data
 * @returns Promise<StockBasket> Updated basket
 * @throws Error with user-friendly message
 */
export async function updateBasketCms(id: string, dto: UpdateBasketDto): Promise<StockBasket> {
  try {
    const response = await stocksApi.put<StockBasket>(`/baskets/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error('Error updating basket:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    if (error.response?.status === 404) {
      throw new Error('Basket not found. It may have been deleted.');
    }
    if (error.response?.status === 409) {
      throw new Error('Basket name already exists. Please use a different name.');
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to update baskets.");
    }
    if (error.response?.status === 400) {
      throw new Error(
        formatValidationMessage(error.response?.data, 'Invalid basket data. Please check your input.'),
      );
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to update basket. Please check your connection.');
    }
    throw new Error('Unable to update basket. Please try again.');
  }
}

/**
 * Delete a basket (soft delete, CMS endpoint)
 * Requires authentication and cms_baskets permission
 * 
 * @param id - Basket ID
 * @returns Promise<{ success: boolean; message: string }> Deletion result
 * @throws Error with user-friendly message
 */
export async function deleteBasketCms(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.delete<{ success: boolean; message: string }>(`/baskets/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting basket:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
    });

    if (error.response?.status === 404) {
      throw new Error('Basket not found or already deleted.');
    }
    if (error.response?.status === 403) {
      throw new Error("You don't have permission to delete baskets.");
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Failed to delete basket. Please check your connection.');
    }
    throw new Error('Unable to delete basket. Please try again.');
  }
}
