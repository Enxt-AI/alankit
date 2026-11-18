import { stocksApi } from './api-client';
import {
  LinkDematRequest,
  DematStatusResponse,
  DematApiResponse,
} from '@/types/demat';

/**
 * Link an existing Demat account
 */
export async function linkDemat(dto: LinkDematRequest): Promise<DematApiResponse> {
  try {
    const response = await stocksApi.post('/demat/link', dto);
    return response.data;
  } catch (error: any) {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.message || 'Failed to link Demat account';

      if (status === 400) {
        throw new Error(message);
      } else if (status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(message);
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to server. Please check your internet connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
}


/**
 * Upload a Demat document (dematStatement or addressProof)
 */
export async function uploadDematDocument(
  documentType: string,
  fileData: { fileUrl: string; fileName: string; fileSize: number }
): Promise<DematApiResponse> {
  try {
    const response = await stocksApi.post(
      `/demat/upload-document/${documentType}`,
      fileData
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Failed to upload document';

      if (status === 400) {
        throw new Error(message);
      } else if (status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(message);
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to server. Please check your internet connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
}

/**
 * Get current Demat account status
 */
export async function getDematStatus(): Promise<DematStatusResponse> {
  try {
    const response = await stocksApi.get('/demat/status');
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Failed to fetch Demat status';

      if (status === 400) {
        throw new Error(message);
      } else if (status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (status === 500) {
        throw new Error('Server error. Please try again later.');
      } else {
        throw new Error(message);
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to server. Please check your internet connection.');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
}

/**
 * Reset Demat to redo verification
 */
export async function resetDemat(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await stocksApi.post('/demat/reset');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please login to continue');
    }
    throw new Error(error.response?.data?.message || 'Failed to reset Demat. Please try again');
  }
}
