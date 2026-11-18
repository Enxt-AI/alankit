import { authApi, stocksApi } from './api-client';
import { AdminLoginResponse, Admin, CreateAdminDto, AdminListResponse } from '../types/admin';
import { sanitizeErrorMessage } from './error-utils';
// NOTE: RelationshipManager import removed as part of RM system deprecation.

let adminVerifyInFlight: Promise<AdminLoginResponse['admin'] | null> | null = null;
let cmsVerifyInFlight: Promise<AdminLoginResponse['admin'] | null> | null = null;
let supportVerifyInFlight: Promise<AdminLoginResponse['admin'] | null> | null = null;
// NOTE: rmVerifyInFlight removed as part of RM system deprecation.
let marketingVerifyInFlight: Promise<Admin | null> | null = null;
let accountingVerifyInFlight: Promise<Admin | null> | null = null;
let operationVerifyInFlight: Promise<Admin | null> | null = null;

function extractErrorMessage(error: any, fallback: string): string {
  return sanitizeErrorMessage(error, fallback);
}

// ============================================
// ADMIN AUTHENTICATION API FUNCTIONS
// ============================================

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  try {
    const response = await authApi.post('/auth/admin/login', { email, password });
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }

    if (response.data.success === false || !response.data?.admin) {
      throw new Error(response.data?.message || 'Invalid email or password');
    }
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Admin privileges required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await authApi.post('/auth/admin/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Admin logout error:', error);
    }
  }
}

export async function verifyAdminSession(): Promise<AdminLoginResponse['admin'] | null> {
  if (adminVerifyInFlight) return adminVerifyInFlight;

  adminVerifyInFlight = (async () => {
    try {
      const response = await authApi.get('/auth/admin/verify');
      return response.data.admin;
    } catch (error: any) {
      // Silently handle 401s for admin verify endpoint (expected after logout)
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/admin/verify')) {
        return null; // Session invalid, return null
      }
      return null;
    } finally {
      adminVerifyInFlight = null;
    }
  })();

  return adminVerifyInFlight;
}

// ============================================
// CMS AUTHENTICATION API FUNCTIONS
// ============================================

export async function cmsLogin(email: string, password: string): Promise<AdminLoginResponse> {
  try {
    const response = await authApi.post('/auth/cms/login', { email, password });
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Content Manager role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

export async function cmsVerifyOtp(email: string, password: string, otp: string): Promise<AdminLoginResponse> {
  try {
    const response = await authApi.post('/auth/cms/verify-otp', { email, password, otp });
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Content Manager role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid OTP'));
  }
}

export async function cmsLogout(): Promise<void> {
  try {
    await authApi.post('/auth/cms/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('CMS logout error:', error);
    }
  }
}

/**
 * Verify CMS session by checking cms_panel_token cookie
 *
 * @param pathname - Optional current route path. If includes '/login', 401 errors are silently handled (expected post-logout).
 * @returns Admin object if session valid
 * @throws AxiosError with response.status for error differentiation (401, 403, etc.)
 *
 * Note: 401 errors are expected after logout and are logged at debug level.
 * Other errors (network, timeout, 500) are logged for debugging and re-thrown.
 */
export async function verifyCMSSession(pathname?: string): Promise<AdminLoginResponse['admin'] | null> {
  if (cmsVerifyInFlight) return cmsVerifyInFlight;

  cmsVerifyInFlight = (async () => {
    try {
      const response = await authApi.get('/auth/cms/verify', {
        timeout: 10000, // 10 second timeout
      });
      return response.data.admin;
    } catch (error: any) {
      // Silently handle 401s for CMS verify endpoint (expected after logout)
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/cms/verify')) {
        return null; // Session invalid, return null
      }

      // Silently handle expected 401s on login page (post-logout)
      if (pathname?.includes('/login') && (error.response?.status === 401 || error.response?.status === 403)) {
        return null; // Expected state, no logging needed
      }

      // Log errors but let them propagate so useCMSAuth can differentiate error types
      if (process.env.NODE_ENV !== 'production') {
        const status = error.response?.status;
        if (status !== 401 && status !== 403) {
          console.error(
            '[verifyCMSSession] Error:',
            error instanceof Error ? error.message : String(error),
            status ? `(HTTP ${status})` : ''
          );
        } else {
          // 401 is expected after logout, log at debug level only
          console.log('[verifyCMSSession] Session expired or logged out (401)');
        }
      }
      // Re-throw the error so useCMSAuth can handle different status codes
      throw error;
    } finally {
      cmsVerifyInFlight = null;
    }
  })();

  return cmsVerifyInFlight;
}

// ============================================
// SUPPORT AUTHENTICATION API FUNCTIONS
// ============================================

export async function supportLogin(email: string, password: string): Promise<AdminLoginResponse> {
  try {
    // Call backend directly
    const response = await authApi.post('/auth/support/login', { email, password });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Support Agent role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

export async function supportLogout(): Promise<void> {
  try {
    // Call backend directly
    await authApi.post('/auth/support/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Support logout error:', error);
    }
  }
}

/**
 * Verify Support session by checking support_panel_token cookie
 *
 * @param pathname - Optional current route path. If includes '/login', 401 errors are silently handled (expected post-logout).
 * @returns Admin object if session valid
 * @throws AxiosError with response.status for error differentiation (401, 403, etc.)
 *
 * Note: 401 errors are expected after logout and are logged at debug level.
 * Other errors (network, timeout, 500) are logged for debugging and re-thrown.
 */
export async function verifySupportSession(pathname?: string): Promise<AdminLoginResponse['admin'] | null> {
  if (supportVerifyInFlight) return supportVerifyInFlight;

  supportVerifyInFlight = (async () => {
    try {
      // Call backend directly
      const response = await authApi.get('/auth/support/verify', {
        timeout: 10000, // 10 second timeout
      });
      return response.data.admin;
    } catch (error: any) {
      // Silently handle 401s for Support verify endpoint (expected after logout)
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/support/verify')) {
        return null; // Session invalid, return null
      }

      // Silently handle expected 401s on login page (post-logout)
      if (pathname?.includes('/login') && (error.response?.status === 401 || error.response?.status === 403)) {
        return null; // Expected state, no logging needed
      }

      // Log errors but let them propagate so useSupportAuth can differentiate error types
      if (process.env.NODE_ENV !== 'production') {
        const status = error.response?.status;
        if (status !== 401 && status !== 403) {
          console.error(
            '[verifySupportSession] Error:',
            error instanceof Error ? error.message : String(error),
            status ? `(HTTP ${status})` : ''
          );
        } else {
          // 401 is expected after logout, log at debug level only
          console.log('[verifySupportSession] Session expired or logged out (401)');
        }
      }
      // Re-throw the error so useSupportAuth can handle different status codes
      throw error;
    } finally {
      supportVerifyInFlight = null;
    }
  })();

  return supportVerifyInFlight;
}

// NOTE: RM authentication API functions (rmLogin, rmLogout, verifyRMSession)
// were removed as part of RM system deprecation.

// ============================================
// MARKETING AUTH ENDPOINTS
// ============================================

/**
 * Verify marketing session - check if marketing_panel_token cookie is valid
 * Endpoint: GET /auth/marketing/verify
 * @param pathname - Current pathname for error handling context
 * @returns Admin object if session valid, null if invalid
 * @throws Error for network/server errors (401/403 handled internally)
 *
 * Note: 401 errors are expected after logout and are logged at debug level.
 * Other errors (network, timeout, 500) are logged for debugging and re-thrown.
 */
export async function verifyMarketingSession(pathname?: string): Promise<Admin | null> {
  if (marketingVerifyInFlight) return marketingVerifyInFlight;

  marketingVerifyInFlight = (async () => {
    try {
      // Call backend directly
      const response = await authApi.get('/auth/marketing/verify', {
        timeout: 10000, // 10 second timeout (hook has 5s timeout, this is safety buffer)
      });
      return response.data.admin;
    } catch (error: any) {
      // Silently handle 401s for marketing verify endpoint (expected after logout)
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/marketing/verify')) {
        return null; // Session invalid, return null
      }

      // Silently handle expected 401s on login page (post-logout)
      if (pathname?.includes('/login') && (error.response?.status === 401 || error.response?.status === 403)) {
        return null; // Expected state, no logging needed
      }

      // Log errors but let them propagate so useMarketingAuth can differentiate error types
      if (process.env.NODE_ENV !== 'production') {
        const status = error.response?.status;
        if (status !== 401 && status !== 403) {
          console.error(
            '[verifyMarketingSession] Error:',
            error instanceof Error ? error.message : String(error),
            status ? `(HTTP ${status})` : ''
          );
        } else {
          // 401 is expected after logout, log at debug level only
          console.log('[verifyMarketingSession] Session expired or logged out (401)');
        }
      }
      // Re-throw the error so useMarketingAuth can handle different status codes
      throw error;
    } finally {
      marketingVerifyInFlight = null;
    }
  })();

  return marketingVerifyInFlight;
}

// ============================================
// ADMIN MANAGEMENT ENDPOINTS
// ============================================

/**
 * Get all admins (Super Admin or Admin with create_cms permission)
 * Endpoint: GET /auth/admins
 * Requires: JWT authentication + super_admin role or create_cms permission
 * @returns Array of admin objects (passwordHash excluded). Super Admins see all, others see Content Managers only.
 * @throws Error with user-friendly message on failure, including 403 for insufficient permissions. Use admin-api.ts wrapper for delegated handling.
 */
export async function getAllAdmins(): Promise<Admin[]> {
  try {
    const response = await authApi.get<AdminListResponse>('/auth/admins');
    return response.data.admins;
  } catch (error: any) {
    console.error('Failed to fetch admins:', error);
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load admin list. Please try again.');
  }
}

/**
 * Create new admin (Super Admin only)
 * Endpoint: POST /auth/admin/create
 * Requires: JWT authentication + super_admin role
 * @param dto - Admin creation data
 * @returns Created admin object
 * @throws Error with user-friendly message on failure
 */
export async function createAdmin(dto: CreateAdminDto): Promise<Admin> {
  try {
    const response = await authApi.post<{ success: boolean; admin: Admin }>('/auth/admin/create', dto);
    return response.data.admin;
  } catch (error: any) {
    console.error('Failed to create admin:', error);
    if (error.response?.status === 400) {
      let message = error.response?.data?.message || '';
      if (Array.isArray(message)) {
        message = message.join(', ');
      } else if (typeof message === 'object' && message !== null) {
        message = JSON.stringify(message);
      }
      
      if (message.toLowerCase().includes('email')) {
        // Preserve detailed validation if it's not just duplicate, otherwise show exists
        if (message.includes('already exists')) throw new Error('Admin with this email already exists.');
        throw new Error(message);
      }
      if (message.toLowerCase().includes('password')) {
        throw new Error(message);
      }
      throw new Error(message || 'Invalid admin data. Please check your inputs.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. Admin with create_cms or Super Admin privileges required.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create admin. Please try again.');
  }
}

/**
 * Update admin permissions (Super Admin only)
 * Endpoint: PATCH /auth/admin/:id
 * Requires: JWT authentication + super_admin role
 * @param adminId - Admin ID to update
 * @param permissions - New permissions array
 * @returns Updated admin object
 * @throws Error with user-friendly message on failure
 */
export async function updateAdminPermissions(adminId: string, permissions: string[]): Promise<Admin> {
  try {
    const response = await authApi.patch<{ success: boolean; admin: Admin }>(
      `/auth/admin/${adminId}`,
      { permissions }
    );
    return response.data.admin;
  } catch (error: any) {
    console.error(`Failed to update admin ${adminId}:`, error);
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || '';
      if (message.includes('own permissions')) {
        throw new Error('Cannot modify your own permissions.');
      }
      if (message.includes('not found')) {
        throw new Error('Admin not found.');
      }
      if (message.includes('inactive')) {
        throw new Error('Cannot update inactive admin.');
      }
      throw new Error(message || 'Invalid request. Please try again.');
    }
    if (error.response?.status === 404) {
      throw new Error('Admin not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. You can only modify Content Managers.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update admin permissions. Please try again.');
  }
}

/**
 * Delete an admin account (Super Admin only)
 * @param adminId - ID of admin to delete
 * @returns Promise resolving on success
 * @throws Error with user-friendly message on failure
 */
export async function deleteAdmin(adminId: string): Promise<void> {
  try {
    await authApi.delete(`/auth/admin/${adminId}`);
  } catch (error: any) {
    console.error(`Failed to delete admin ${adminId}:`, error);
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || '';
      if (message.includes('own account')) {
        throw new Error('Cannot delete your own account.');
      }
      if (message.includes('not found')) {
        throw new Error('Admin not found.');
      }
      throw new Error(message || 'Invalid request. Please try again.');
    }
    if (error.response?.status === 404) {
      throw new Error('Admin not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied. You can only modify Content Managers.');
    }
    if (error.response?.status === 409) {
      // Blocked deletion (e.g. no fallback owner for attributed records).
      // Nest serialises ConflictException as { message } or { message: {...} }.
      const raw = (error.response?.data as any)?.message;
      const message =
        typeof raw === 'string'
          ? raw
          : typeof raw?.message === 'string'
            ? raw.message
            : 'This user owns records that must be reassigned before deletion.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete admin. Please try again.');
  }
}

/**
 * Marketing login - authenticate marketing manager
 * @param email - Admin email
 * @param password - Admin password
 * @returns Promise with admin data and token
 * @throws Error with user-friendly message on failure (401, 403, network errors)
 */
export async function marketingLogin(email: string, password: string): Promise<{ admin: Admin; token: string }> {
  try {
    // Call backend directly
    const response = await authApi.post('/auth/marketing/login', { email, password });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    if (response.data.success === false || !response.data?.admin) {
      throw new Error(response.data?.message || 'Invalid email or password');
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Marketing Manager role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

/**
 * Marketing logout - clear marketing session and cookie
 * Handles errors silently with console logging in development
 */
export async function marketingLogout(): Promise<void> {
  try {
    // Call backend directly
    await authApi.post('/auth/marketing/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Marketing logout error:', error);
    }
  }
}

// ============================================
// ACCOUNTING AUTH ENDPOINTS
// ============================================

/**
 * Accounting login - authenticate accounting manager
 * @param email - Admin email
 * @param password - Admin password
 * @returns Promise with admin data and token
 * @throws Error with user-friendly message on failure (401, 403, network errors)
 */
export async function accountingLogin(email: string, password: string): Promise<{ admin: Admin; token: string }> {
  try {
    // Call backend directly
    const response = await authApi.post('/auth/accounting/login', { email, password });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    if (response.data.success === false || !response.data?.admin) {
      throw new Error(response.data?.message || 'Invalid email or password');
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Accounting Manager role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

/**
 * Accounting logout - clear accounting session and cookie
 * Handles errors silently with console logging in development
 */
export async function accountingLogout(): Promise<void> {
  try {
    // Call backend directly
    await authApi.post('/auth/accounting/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Accounting logout error:', error);
    }
  }
}

/**
 * Verify accounting session - check if accounting_panel_token cookie is valid
 * Endpoint: GET /auth/accounting/verify
 * @param pathname - Current pathname for error handling context
 * @returns Admin object if session valid, null if invalid
 * @throws Error for network/server errors (401/403 handled internally)
 */
export async function verifyAccountingSession(pathname?: string): Promise<Admin | null> {
  if (accountingVerifyInFlight) return accountingVerifyInFlight;

  accountingVerifyInFlight = (async () => {
    try {
      // Call backend directly
      const response = await authApi.get('/auth/accounting/verify', {
        timeout: 10000,
      });
      return response.data.admin;
    } catch (error: any) {
      // Silently handle 401s for accounting verify endpoint (expected after logout)
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/accounting/verify')) {
        return null; 
      }

      // Silently handle expected 401s on login page (post-logout)
      if (pathname?.includes('/login') && (error.response?.status === 401 || error.response?.status === 403)) {
        return null; 
      }

      // Log errors but let them propagate
      if (process.env.NODE_ENV !== 'production') {
        const status = error.response?.status;
        if (status !== 401 && status !== 403) {
          console.error(
            '[verifyAccountingSession] Error:',
            error instanceof Error ? error.message : String(error),
            status ? `(HTTP ${status})` : ''
          );
        } else {
          console.log('[verifyAccountingSession] Session expired or logged out (401)');
        }
      }
      throw error;
    } finally {
      accountingVerifyInFlight = null;
    }
  })();

  return accountingVerifyInFlight;
}

// ============================================
// OPERATION AUTH ENDPOINTS
// ============================================

/**
 * Operation login - authenticate operation manager
 * @param email - Admin email
 * @param password - Admin password
 * @returns Promise with admin data and token
 * @throws Error with user-friendly message on failure
 */
export async function operationLogin(email: string, password: string): Promise<{ admin: Admin; token: string }> {
  try {
    const response = await authApi.post('/auth/operation/login', { email, password });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    if (response.data.success === false || !response.data?.admin) {
      throw new Error(response.data?.message || 'Invalid email or password');
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('Access denied. Operations Manager role required.');
    }
    throw new Error(extractErrorMessage(error, 'Invalid email or password'));
  }
}

/**
 * Operation logout - clear operation session and cookie
 */
export async function operationLogout(): Promise<void> {
  try {
    await authApi.post('/auth/operation/logout');
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Operation logout error:', error);
    }
  }
}

/**
 * Verify operation session - check if operation_panel_token cookie is valid
 * Endpoint: GET /auth/operation/verify
 * @param pathname - Current pathname for error handling context
 * @returns Admin object if session valid, null if invalid
 * @throws Error for network/server errors
 */
export async function verifyOperationSession(pathname?: string): Promise<Admin | null> {
  if (operationVerifyInFlight) return operationVerifyInFlight;

  operationVerifyInFlight = (async () => {
    try {
      const response = await authApi.get('/auth/operation/verify', {
        timeout: 10000,
      });
      return response.data.admin;
    } catch (error: any) {
      if ((error.response?.status === 401 || error.response?.status === 403) && error.config?.url?.includes('/auth/operation/verify')) {
        return null;
      }

      if (pathname?.includes('/login') && (error.response?.status === 401 || error.response?.status === 403)) {
        return null;
      }

      if (process.env.NODE_ENV !== 'production') {
        const status = error.response?.status;
        if (status !== 401 && status !== 403) {
          console.error(
            '[verifyOperationSession] Error:',
            error instanceof Error ? error.message : String(error),
            status ? `(HTTP ${status})` : ''
          );
        } else {
          console.log('[verifyOperationSession] Session expired or logged out (401)');
        }
      }
      throw error;
    } finally {
      operationVerifyInFlight = null;
    }
  })();

  return operationVerifyInFlight;
}

// ============================================
// SESSION MANAGEMENT API FUNCTIONS
// ============================================

export interface ActiveSession {
  id: string;
  portal: string;
  device: string;
  ip: string;
  loginTime: string | null;
  lastActive: string | null;
  expiresInSeconds: number | null;
  isCurrent: boolean;
}

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  try {
    const response = await authApi.get('/auth/sessions');
    return response.data.sessions || [];
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch active sessions'));
  }
}

export async function terminateSession(sessionId: string): Promise<void> {
  try {
    await authApi.delete(`/auth/sessions/${sessionId}`);
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to terminate session'));
  }
}

export async function terminateAllOtherSessions(): Promise<{ message: string }> {
  try {
    const response = await authApi.post('/auth/sessions/terminate-others');
    return response.data;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to terminate other sessions'));
  }
}