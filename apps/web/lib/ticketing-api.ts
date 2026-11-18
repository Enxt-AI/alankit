import axios from 'axios';
import { sanitizeErrorMessage } from './error-utils';

function resolveTicketingBaseURL(envValue: string | undefined): string {
  const fallback = '/api';
  const raw = (envValue || '').trim();

  // In the browser, always prefer same-origin requests so cookies
  // (HttpOnly auth) are set/sent reliably in local dev.
  if (typeof window !== 'undefined') {
    return fallback;
  }

  // SERVER-SIDE: Node cannot resolve relative paths — use an absolute URL.
  // When BACKEND_ORIGIN is not set, route through the Next.js app itself
  // so dev rewrites forward the request to the correct microservice.
  if (!raw || raw.startsWith('/')) {
    const origin = process.env.BACKEND_ORIGIN
      || `http://localhost:${process.env.PORT || 3000}`;
    return origin + (raw || fallback);
  }

  // For absolute URLs, ensure we include the /api prefix so calls like
  // ticketingApi.get('/tickets') hit <origin>/api/tickets.
  const origin = raw.replace(/\/$/, '');
  if (origin.endsWith('/api')) return origin;
  return `${origin}/api`;
}

const ticketingApi = axios.create({
  baseURL: resolveTicketingBaseURL(process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL),
  withCredentials: true,
  timeout: 10000,
});

// Response interceptor for error handling
ticketingApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access to ticketing service');
    }
    if (error && typeof error === "object") {
      const cleanMsg = sanitizeErrorMessage(error);
      error.message = cleanMsg;
      if (error.response?.data) {
        if (typeof error.response.data === "object") {
          (error.response.data as any).message = cleanMsg;
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface QueryTicketDto {
  status?: string;
  priority?: string | null;
  category?: string;
  createdBy?: string;
  assignedTo?: string;
  escalatedTo?: string; // Filter by who the ticket was escalated to
  source?: string;
  escalated?: boolean;
  unassigned?: boolean;
  createdFrom?: string;
  createdTo?: string;
  reopenCount?: number;
  skip?: number;
  take?: number;
}

export interface CreateTicketDto {
  title: string;
  description: string;
  labels?: string[];
  category?: string;
  priority?: string | null;
  createdBy: string;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string | null;
  assignedTo?: string;
}

export interface CreateCommentDto {
  content: string;
  userId: string;
  isInternal?: boolean;
}

export const getAllTickets = async (query?: QueryTicketDto) => {
  try {
    const response = await ticketingApi.get('/tickets', { params: query });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch tickets');
  }
};

export const getMyTickets = async (userId: string) => {
  try {
    const response = await ticketingApi.get('/tickets', { params: { createdBy: userId } });
    return response.data.data; // Return the data array from paginated response
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch your tickets');
  }
};

/**
 * Fetch the authenticated user's tickets with optional status filter and pagination.
 * Omitting `status` returns tickets of all statuses.
 */
export const getUserTickets = async (
  userId: string,
  options?: { status?: string; skip?: number; take?: number },
) => {
  try {
    const { status, ...pagination } = options ?? {};
    const response = await ticketingApi.get('/tickets', {
      params: { createdBy: userId, ...(status ? { status } : {}), ...pagination },
    });
    return response.data.data; // Return the data array from paginated response
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch tickets');
  }
};

export const getTicketById = async (id: string) => {
  try {
    const response = await ticketingApi.get(`/tickets/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch ticket details');
  }
};

export const createTicket = async (
  data: CreateTicketDto | FormData,
  onUploadProgress?: (progressEvent: any) => void,
  signal?: AbortSignal
) => {
  try {
    const response = await ticketingApi.post('/tickets', data, {
      onUploadProgress,
      signal,
    });
    return response.data;
  } catch (error: any) {
    if (axios.isCancel(error)) {
      throw new Error('Upload cancelled');
    }
    throw new Error(error.response?.data?.message || 'Failed to create ticket');
  }
};

export const updateTicket = async (id: string, data: UpdateTicketDto) => {
  try {
    const response = await ticketingApi.patch(`/tickets/${id}`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update ticket');
  }
};

export const deleteTicket = async (id: string) => {
  try {
    const response = await ticketingApi.delete(`/tickets/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete ticket');
  }
};

export const getTicketComments = async (ticketId: string) => {
  try {
    const response = await ticketingApi.get(`/tickets/${ticketId}/comments`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch comments');
  }
};

export const createComment = async (ticketId: string, data: CreateCommentDto) => {
  try {
    const response = await ticketingApi.post(`/tickets/${ticketId}/comments`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to add comment');
  }
};

export const getAllLabels = async () => {
  try {
    const response = await ticketingApi.get('/labels');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch labels');
  }
};