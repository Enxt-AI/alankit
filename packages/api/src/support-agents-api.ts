import { authApi } from './api-client';
export interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface SupportAgent extends Admin {
  availability?: 'available' | 'busy' | 'unavailable';
  availabilityNote?: string;
  activeTicketCount?: number;
}

/**
 * Get all Support Agents
 * Endpoint: GET /auth/admins (filtered for SUPPORT_AGENT role)
 * @returns Array of Support Agent objects (passwordHash excluded)
 * @throws Error with user-friendly message on failure, including 403 for insufficient permissions
 */
export async function getAllSupportAgents(): Promise<SupportAgent[]> {
  try {
    const response = await authApi.get('/auth/admins', {
      params: { role: 'SUPPORT_AGENT' },
    });
    const admins = Array.isArray(response.data?.admins) ? response.data.admins : [];
    return admins.filter((a: Admin) => a.role === 'SUPPORT_AGENT') || [];
  } catch (error: any) {
    // Handle 403 with error instead of silent empty array
    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to view support agents. Please contact your administrator.');
    }

    // Handle other errors
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to load support agents. Please try again.';
    throw new Error(errorMessage);
  }
}

/**
 * Update Support Agent availability
 * Endpoint: PATCH /auth/admins/:id/availability
 * @param id - Support Agent ID
 * @param availability - Availability status ('available' | 'busy' | 'unavailable')
 * @param availabilityNote - Optional note about availability
 * @returns Updated Support Agent object
 * @throws Error with user-friendly message on failure
 */
export async function updateSupportAgentAvailability(
  id: string,
  availability: string,
  availabilityNote?: string
): Promise<Admin> {
  try {
    const response = await authApi.patch(`/auth/admins/${id}/availability`, {
      availability,
      availabilityNote,
    });
    return response.data.admin;
  } catch (error: any) {
    // Provide user-friendly error messages
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. You do not have permission to update support agent availability.');
    }
    if (error.response?.status === 400) {
      throw new Error('Invalid availability data provided.');
    }
    if (error.response?.status === 404) {
      throw new Error('Support agent not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    const errorMessage = error.response?.data?.error || error.message || 'Failed to update support agent availability. Please try again.';
    throw new Error(errorMessage);
  }
}