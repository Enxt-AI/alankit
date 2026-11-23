import axios from 'axios';

function resolveTicketingBaseURL(envValue: string | undefined): string {
  const fallback = '/api';
  const raw = (envValue || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/')) return raw;

  const origin = raw.replace(/\/$/, '');
  if (origin.endsWith('/api')) return origin;
  return `${origin}/api`;
}

import { requestInterceptor, requestErrorInterceptor } from './api-client';

const supportTicketsApi = axios.create({
  baseURL: resolveTicketingBaseURL(process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL),
  withCredentials: true,
  timeout: 60000,
});

// Request interceptor to attach panel context and device fingerprint
supportTicketsApi.interceptors.request.use(requestInterceptor, requestErrorInterceptor);

// Response interceptor for error handling
supportTicketsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized access to support tickets service');
    }
    if (error.response?.status === 403) {
      console.error('Insufficient permissions for support tickets operation');
    }
    return Promise.reject(error);
  }
);

// Import existing types from ticketing-api
import type { QueryTicketDto, CreateCommentDto } from './ticketing-api';

// Define additional DTOs for support operations
export interface ResolveTicketDto {
  resolvedBy: string;
}

export interface AssignTicketDto {
  agentId: string;
  assignedBy: string;
}

export interface UpdateTicketDto {
  status?: string;
  priority?: string;
  category?: string;
  labels?: string[];
}

// Query Functions
export async function getMyTickets(agentId: string, query?: QueryTicketDto) {
  try {
    const params = new URLSearchParams();
    params.append('assignedTo', agentId);

    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.category) params.append('category', query.category);
    if (query?.createdBy) params.append('createdBy', query.createdBy);

    const response = await supportTicketsApi.get(`/tickets?${params.toString()}`);
    return response.data.data; // Return the data array from paginated response
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch my tickets');
  }
}

export async function getAllTickets(query?: QueryTicketDto) {
  try {
    const params = new URLSearchParams();

    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.category) params.append('category', query.category);
    if (query?.createdBy) params.append('createdBy', query.createdBy);

    const response = await supportTicketsApi.get(`/tickets?${params.toString()}`);
    return response.data.data; // Return the data array from paginated response
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch all tickets');
  }
}

export async function getEscalatedTickets(query?: QueryTicketDto) {
  try {
    const params = new URLSearchParams();
    params.append('escalated', 'true');

    if (query?.status) params.append('status', query.status);
    if (query?.priority) params.append('priority', query.priority);
    if (query?.category) params.append('category', query.category);
    if (query?.createdBy) params.append('createdBy', query.createdBy);
    if (query?.escalatedTo) params.append('escalatedTo', query.escalatedTo);

    const response = await supportTicketsApi.get(`/tickets?${params.toString()}`);
    return response.data.data; // Return the data array from paginated response
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch escalated tickets');
  }
}

export async function getTicketById(id: string) {
  try {
    const response = await supportTicketsApi.get(`/tickets/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Ticket not found');
    }
    throw new Error(error.response?.data?.message || 'Failed to fetch ticket details');
  }
}

// Mutation Functions
export async function resolveTicket(ticketId: string, resolvedBy: string) {
  try {
    const response = await supportTicketsApi.post(`/tickets/${ticketId}/resolve`, {
      resolvedBy,
    } as ResolveTicketDto);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to resolve ticket');
  }
}

export async function assignTicket(ticketId: string, agentId: string, assignedBy: string) {
  try {
    const response = await supportTicketsApi.post(`/tickets/${ticketId}/assign`, {
      agentId,
      assignedBy,
    } as AssignTicketDto);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to assign ticket');
  }
}

export async function updateTicketStatus(ticketId: string, status: string) {
  try {
    const response = await supportTicketsApi.patch(`/tickets/${ticketId}`, {
      status,
    } as UpdateTicketDto);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update ticket status');
  }
}

export async function updateTicketPriority(ticketId: string, priority: string | null) {
  try {
    const response = await supportTicketsApi.patch(`/tickets/${ticketId}`, {
      priority: !priority ? null : priority,
    } as UpdateTicketDto);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update ticket priority');
  }
}

export async function addComment(ticketId: string, content: string, userId: string, isInternal: boolean) {
  try {
    const response = await supportTicketsApi.post(`/tickets/${ticketId}/comments`, {
      content,
      userId,
      isInternal,
    } as CreateCommentDto);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to add comment');
  }
}

export async function escalateTicket(ticketId: string) {
  try {
    const response = await supportTicketsApi.post(`/tickets/${ticketId}/escalate`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to escalate ticket');
  }
}

// Export the axios instance for use in other API modules
export { supportTicketsApi };