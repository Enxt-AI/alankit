import axios from 'axios';

function resolveTicketingBaseURL(envValue: string | undefined): string {
  const fallback = '/api';
  const raw = (envValue || '').trim();

  if (typeof window !== 'undefined') {
    return fallback;
  }

  if (!raw) return fallback;
  if (raw.startsWith('/')) return raw;

  const origin = raw.replace(/\/$/, '');
  if (origin.endsWith('/api')) return origin;
  return `${origin}/api`;
}

// Import existing types from ticketing-api
import type { QueryTicketDto, CreateCommentDto } from './ticketing-api';

// Define additional DTOs for admin operations
export interface AssignTicketDto {
  agentId: string;
  assignedBy: string;
}

export interface UpdateTicketStatusDto {
  status: string;
  updatedBy: string;
}

const adminTicketsApi = axios.create({
  baseURL: resolveTicketingBaseURL(process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL),
  withCredentials: true,
  timeout: 60000,
});

function getApiErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data;
  if (!data) return fallback;

  // NestJS commonly uses `message` (string | string[]) and `error`.
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (Array.isArray(data.message) && data.message.length > 0) {
    const first = data.message.find((m: unknown) => typeof m === 'string' && m.trim());
    if (typeof first === 'string') return first;
  }
  if (typeof data.error === 'string' && data.error.trim()) return data.error;

  return fallback;
}

// Response interceptor for error handling
adminTicketsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized access to admin tickets service');
    }
    if (error.response?.status === 403) {
      console.error('Insufficient permissions for admin tickets operation');
    }
    return Promise.reject(error);
  }
);

/**
 * Get all tickets for admin management
 * @param query - Query parameters for filtering tickets
 * @returns Array of tickets
 */
export async function getAllAdminTickets(query?: QueryTicketDto) {
  try {
    const response = await adminTicketsApi.get('/tickets', { params: query });
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to view tickets.');
    }
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to load tickets. Please try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Get a specific ticket by ID
 * @param id - Ticket ID
 * @returns Ticket details
 */
export async function getTicketById(id: string) {
  try {
    const response = await adminTicketsApi.get(`/tickets/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to view this ticket.');
    }
    if (error.response?.status === 404) {
      throw new Error(getApiErrorMessage(error, 'Ticket not found.'));
    }
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to load ticket. Please try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Assign a ticket to a support agent
 * @param ticketId - Ticket ID
 * @param agentId - Agent ID to assign to
 * @param assignedBy - Admin ID performing the assignment
 * @returns Updated ticket
 */
export async function assignTicket(ticketId: string, agentId: string, assignedBy: string) {
  try {
    const response = await adminTicketsApi.post(`/tickets/${ticketId}/assign`, {
      agentId,
      assignedBy,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to assign tickets.');
    }
    if (error.response?.status === 404) {
      // Backend returns 404 for missing ticket OR missing agent.
      throw new Error(getApiErrorMessage(error, 'Ticket or agent not found.'));
    }
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to assign ticket. Please try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Bulk assign multiple tickets to a support agent
 * @param ticketIds - Array of ticket IDs
 * @param agentId - Agent ID to assign to
 * @param assignedBy - Admin ID performing the assignment
 * @returns Array of updated tickets
 */
export async function bulkAssignTickets(ticketIds: string[], agentId: string, assignedBy: string) {
  const results = [];
  for (const ticketId of ticketIds) {
    try {
      const result = await assignTicket(ticketId, agentId, assignedBy);
      results.push(result);
    } catch (error) {
      console.error(`Failed to assign ticket ${ticketId}:`, error);
      throw error; // Re-throw to stop the bulk operation
    }
  }
  return results;
}

/**
 * Escalate a ticket to Super Admin level
 * @param ticketId - Ticket ID to escalate
 * @returns Updated ticket
 */
export async function escalateTicket(ticketId: string) {
  try {
    const response = await adminTicketsApi.post(`/tickets/${ticketId}/escalate`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to escalate tickets.');
    }
    if (error.response?.status === 404) throw new Error(getApiErrorMessage(error, 'Ticket not found.'));
    if (error.response?.status === 400) {
      throw new Error('Ticket is already escalated.');
    }
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to escalate ticket. Please try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Update ticket status
 * @param ticketId - Ticket ID
 * @param status - New status
 * @param updatedBy - Admin ID performing the update
 * @returns Updated ticket
 */
export async function updateTicketStatus(ticketId: string, status: string, updatedBy: string) {
  try {
    const response = await adminTicketsApi.patch(`/tickets/${ticketId}`, {
      status,
      updatedBy,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to update ticket status.');
    }
    if (error.response?.status === 404) throw new Error(getApiErrorMessage(error, 'Ticket not found.'));
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to update ticket status. Please try again.');
    throw new Error(errorMessage);
  }
}

/**
 * Add an internal comment to a ticket
 * @param ticketId - Ticket ID
 * @param content - Comment content
 * @param userId - Admin ID adding the comment
 * @param isInternal - Whether this is an internal comment
 * @returns Created comment
 */
export async function addComment(ticketId: string, content: string, userId: string, isInternal: boolean = true) {
  try {
    const response = await adminTicketsApi.post(`/tickets/${ticketId}/comments`, {
      content,
      userId,
      isInternal,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to add comments.');
    }
    if (error.response?.status === 404) throw new Error(getApiErrorMessage(error, 'Ticket not found.'));
    const errorMessage = getApiErrorMessage(error, error.message || 'Failed to add comment. Please try again.');
    throw new Error(errorMessage);
  }
}