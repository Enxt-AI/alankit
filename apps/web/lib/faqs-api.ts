import { stocksApi } from './api-client';
import { Faq, CreateFaqDto, UpdateFaqDto } from '@/types/faq';

export async function getAllFaqs(filters?: { stockId?: string; category?: string }): Promise<Faq[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.stockId) params.append('stockId', filters.stockId);
    if (filters?.category) params.append('category', filters.category);
    const qs = params.toString();
    const endpoint = qs ? `/faqs?${qs}` : '/faqs';
    const response = await stocksApi.get(endpoint);
    return Array.isArray(response.data) ? response.data : [];
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
    return Array.isArray(response.data) ? response.data : [];
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
    return Array.isArray(response.data) ? response.data : [];
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

/**
 * Generate deterministic, data-driven fallback FAQs for a stock.
 * Shared between server (JSON-LD) and client (StockFaqSection) so both render
 * identical answers.
 */
export function getDefaultStockFaqs(stock: {
  id: string;
  name: string;
  price: number;
  minimumPurchaseQuantity?: number | null;
  maximumPurchaseQuantity?: number | null;
  cin?: string | null;
  isin?: string | null;
}): Faq[] {
  const minQty = stock.minimumPurchaseQuantity || 1;
  const estimatedOrderVal = (minQty * stock.price).toLocaleString("en-IN");
  const stockName = stock.name.trim();

  return [
    {
      id: `dyn-price-${stock.id}`,
      title: `What is the current share price of ${stockName} unlisted shares?`,
      answer: `The current price of ${stockName} unlisted shares is ₹${stock.price.toLocaleString("en-IN")} per share on UnlistedStox. Prices in the unlisted market are dynamically influenced by secondary market demand, recent company valuation rounds, and financial performances.`,
      category: "Investing",
      isActive: true,
    },
    {
      id: `dyn-minqty-${stock.id}`,
      title: `What is the minimum order quantity to buy ${stockName} shares?`,
      answer: `The minimum purchase requirement for ${stockName} is ${minQty} ${minQty === 1 ? 'share' : 'shares'} (estimated at ₹${estimatedOrderVal})${stock.maximumPurchaseQuantity ? `, with a maximum purchase limit of ${stock.maximumPurchaseQuantity} shares per order` : ''}. You can invest in quantities within this range based on your portfolio preferences.`,
      category: "Investing",
      isActive: true,
    },
    {
      id: `dyn-demat-${stock.id}`,
      title: `How are ${stockName} unlisted shares credited to my Demat account?`,
      answer: `After your payment is confirmed and KYC is verified, ${stockName} shares are transferred off-market via CDSL or NSDL directly into your linked Demat account. The standard settlement timeline is T+1 to T+2 business days, and you will receive an SMS and email notification directly from your depository upon credit.`,
      category: "Investing",
      isActive: true,
    },
    {
      id: `dyn-safety-${stock.id}`,
      title: `Is it safe and legal to buy ${stockName} unlisted shares in India?`,
      answer: `Yes, buying unlisted shares is completely legal in India under the Companies Act, 2013 and SEBI regulations. All transactions on UnlistedStox are carried out through legitimate demat-to-demat off-market transfers, ensuring verified ownership in your depository account.`,
      category: "General",
      isActive: true,
    },
    {
      id: `dyn-identifiers-${stock.id}`,
      title: `What are the CIN and ISIN details for ${stockName}?`,
      answer: `${stockName} is registered under Corporate Identification Number (CIN) ${stock.cin || 'N/A'}${stock.isin ? ` and International Securities Identification Number (ISIN) ${stock.isin}` : ''}. You can use these official identifiers to verify corporate filings on the MCA portal and track holding statements in your Demat account.`,
      category: "General",
      isActive: true,
    },
    {
      id: `dyn-tax-${stock.id}`,
      title: `How are capital gains taxed when selling ${stockName} unlisted shares?`,
      answer: `For unlisted equity shares, holding for more than 24 months is classified as Long-Term Capital Gains (LTCG) taxed at 12.5% without indexation (as per Finance Act 2024). If held for 24 months or less, gains are treated as Short-Term Capital Gains (STCG) and taxed at your applicable individual income tax slab rates.`,
      category: "Investing",
      isActive: true,
    },
  ];
}