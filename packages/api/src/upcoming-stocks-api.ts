import { stocksApi } from './api-client';
import type { CreateUpcomingStockDto, UpdateUpcomingStockDto, UpcomingStock } from '@/types/upcoming-stock';

type ApiErrorShape = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as ApiErrorShape;
  return maybeError?.response?.data?.message || maybeError?.message || fallback;
}

// ============================================
// Upcoming Stocks - Admin/CMS management API
// ============================================

export async function getAllUpcomingStocksAdmin(): Promise<UpcomingStock[]> {
  try {
    const response = await stocksApi.get('/admin/upcoming-stocks/all');
    return response.data;
  } catch (error: unknown) {
    const maybeError = error as ApiErrorShape;
    if (maybeError?.response?.status === 403) {
      return [];
    }
    throw new Error('Failed to load upcoming stocks. Please try again.');
  }
}

export async function getAllUpcomingStocksCms(): Promise<UpcomingStock[]> {
  try {
    const response = await stocksApi.get('/cms/upcoming-stocks/all');
    return response.data;
  } catch (error: unknown) {
    const maybeError = error as ApiErrorShape;
    if (maybeError?.response?.status === 403) {
      return [];
    }
    throw new Error('Failed to load upcoming stocks. Please try again.');
  }
}

export async function getUpcomingStockById(id: string): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.get(`/upcoming-stocks/${id}`);
    return response.data;
  } catch (error: unknown) {
    const maybeError = error as ApiErrorShape;
    if (maybeError?.response?.status === 404) {
      throw new Error('Upcoming stock not found.');
    }
    throw new Error('Failed to load upcoming stock. Please try again.');
  }
}

export async function createUpcomingStock(dto: CreateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;

    const response = await stocksApi.post('/admin/upcoming-stocks', payload);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock.'));
  }
}

export async function createUpcomingStockCms(dto: CreateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;

    const response = await stocksApi.post('/cms/upcoming-stocks', payload);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock.'));
  }
}

export async function updateUpcomingStock(id: string, dto: UpdateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;

    const response = await stocksApi.put(`/admin/upcoming-stocks/${id}`, payload);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock.'));
  }
}

export async function updateUpcomingStockCms(id: string, dto: UpdateUpcomingStockDto): Promise<UpcomingStock> {
  try {
    // Backend DTO forbids extra fields; never send stock-only fields like isPopular.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isPopular, ...payload } = dto as any;

    const response = await stocksApi.put(`/cms/upcoming-stocks/${id}`, payload);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock.'));
  }
}

export async function deleteUpcomingStock(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/admin/upcoming-stocks/${id}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock.'));
  }
}

export async function deleteUpcomingStockCms(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/cms/upcoming-stocks/${id}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock.'));
  }
}
