import { stocksApi } from './api-client';
import { Faq, CreateFaqDto, UpdateFaqDto } from '@/types/faq';

export async function getAllFaqs(): Promise<Faq[]> {
  try {
    const response = await stocksApi.get('/faqs');
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Failed to fetch FAQs';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function getFaqById(id: string): Promise<Faq> {
  try {
    const response = await stocksApi.get(`/faqs/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('FAQ not found');
    }
    const message = error.response?.data?.message || 'Failed to fetch FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function getAllFaqsAdmin(): Promise<Faq[]> {
  try {
    const response = await stocksApi.get('/faqs/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin FAQs:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for fetching admin FAQs:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load FAQs. Please try again.');
  }
}

/**
 * Note: Returns empty array on 403 (permission denied) instead of throwing error.
 */
export async function getAllFaqsCms(): Promise<Faq[]> {
  try {
    console.log('[faqs-api] Calling CMS endpoint: /faqs/cms/all');
    const response = await stocksApi.get('/faqs/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS FAQs:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for fetching CMS FAQs:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load CMS FAQs. Please try again.');
  }
}

export async function createFaqCms(dto: CreateFaqDto): Promise<Faq> {
  try {
    const response = await stocksApi.post('/faqs/cms', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create FAQs');
    }
    const message = error.response?.data?.message || 'Failed to create FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function updateFaqCms(id: string, dto: UpdateFaqDto): Promise<Faq> {
  try {
    const response = await stocksApi.put(`/faqs/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update FAQs');
    }
    if (error.response?.status === 404) {
      throw new Error('FAQ not found');
    }
    const message = error.response?.data?.message || 'Failed to update FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function deleteFaqCms(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/faqs/cms/${id}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete FAQs');
    }
    if (error.response?.status === 404) {
      throw new Error('FAQ not found');
    }
    const message = error.response?.data?.message || 'Failed to delete FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function createFaq(dto: CreateFaqDto): Promise<Faq> {
  try {
    const response = await stocksApi.post('/faqs/admin', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create FAQs');
    }
    const message = error.response?.data?.message || 'Failed to create FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function updateFaq(id: string, dto: UpdateFaqDto): Promise<Faq> {
  try {
    const response = await stocksApi.put(`/faqs/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update FAQs');
    }
    if (error.response?.status === 404) {
      throw new Error('FAQ not found');
    }
    const message = error.response?.data?.message || 'Failed to update FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

export async function deleteFaq(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/faqs/admin/${id}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete FAQs');
    }
    if (error.response?.status === 404) {
      throw new Error('FAQ not found');
    }
    const message = error.response?.data?.message || 'Failed to delete FAQ';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}