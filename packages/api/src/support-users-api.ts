import { authApi } from './api-client';

/**
 * User data returned by getUserById endpoint
 */
export interface UserBasicInfo {
  id: string;
  email: string | null;
  fullName: string | null;
}

/**
 * Extended user data for admin KYC review
 * Includes KYC data and documents
 */
export interface UserDetailsWithKyc extends UserBasicInfo {
  phone: string | null;
  currentStep: number;
  kycStatus: string;
  kycData: any;
  kycDocuments: Record<string, { url: string; uploadedAt?: string }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get user by ID
 * Endpoint: GET /auth/user/:id
 * Public endpoint - no authentication required
 * Used for displaying ticket creator information
 * @param userId - User's unique ID
 * @returns User basic info or null if not found
 * @throws Error if network error or server error
 */
export async function getUserById(userId: string): Promise<UserBasicInfo | null> {
  try {
    const response = await authApi.get<UserBasicInfo>(`/auth/user/${userId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      console.warn('[User API] User not found (expected for agents/invalid IDs):', userId);
      return null;
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to fetch user information.');
  }
}

/**
 * Get detailed user information by ID (Admin only)
 * Endpoint: GET /admin/users/:userId
 * Requires admin authentication
 * Used for KYC review and user management
 * @param userId - User's unique ID
 * @returns User details with KYC data
 * @throws Error if unauthorized, not found, or server error
 */
export async function getUserDetailsWithKyc(userId: string): Promise<UserDetailsWithKyc> {
  try {
    const response = await authApi.get<UserDetailsWithKyc>(`/auth/admin/users/${userId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Unauthorized - Please log in as admin');
    }
    if (error.response?.status === 403) {
      throw new Error('Forbidden - Admin access required');
    }
    if (error.response?.status === 404) {
      throw new Error('User not found');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to fetch user details.');
  }
}