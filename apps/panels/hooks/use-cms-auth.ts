import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../store/auth-store';
import { verifyCMSSession } from '../lib/auth-api';
import type { AdminPermission } from '../types/admin';
import { notify } from '@/components/ui/floating-notification';

/**
 * CMS authentication hook with session verification
 *
 * Features:
 * - Automatic session verification on mount/route change via direct backend calls
 * - Skips verification during active logout (prevents 401 errors)
 * - Redirects to login if session invalid
 * - Provides permission checking utilities
 * - Cookies are read from localhost:3003 domain in development
 *
 * @returns CMS admin state, loading state, and auth actions
 */
export function useCMSAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const redirectInitiated = useRef(false); // Prevent multiple redirects
  const {
    cmsAdmin,
    isCMSLoading,
    cmsError,
    cmsLogin,
    cmsVerifyOtp,
    cmsLogout,
    setCMSLoading,
    setCMSError,
    setCMSAdmin,
    isLoggingOut,
  } = useAuthStore();

  // Verify CMS session on mount
  useEffect(() => {
    // Reset redirect flag when admin state changes
    redirectInitiated.current = false;
    
    let isMounted = true; // Prevent state updates after unmount
    
    const verifySession = async () => {
      // Skip verification if we're on the login page (prevent timeout race, preserve login state)
      if (pathname === '/cms/login') {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useCMSAuth] On login page, skipping session verification');
        }
        setCMSLoading(false);
        setCMSError(null);
        // No setCMSAdmin(null) - preserve login-set state for redirect
        return;
      }
      
      // Skip verification during logout to prevent 401 errors
      if (isLoggingOut) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useCMSAuth] Logout in progress, skipping session verification');
        }
        setCMSLoading(false);
        return;
      }
      
      if (!cmsAdmin && isMounted) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useCMSAuth] No admin found, starting session verification');
        }
        setCMSLoading(true);
        
        const timeoutId = setTimeout(() => {
          if (isMounted && process.env.NODE_ENV !== 'production') {
            console.log('[useCMSAuth] Verification timeout reached, setting loading to false');
          }
          if (isMounted) {
            setCMSLoading(false);
            setCMSError('Session verification timeout');
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/cms/login');
            }
          }
        }, 15000); // 15 second timeout
        
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useCMSAuth] Calling verifyCMSSession...');
          }
          const adminData = await verifyCMSSession(pathname);
          clearTimeout(timeoutId); // Clear timeout on success
          
          if (!isMounted) return; // Component unmounted
          
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useCMSAuth] verifyCMSSession returned:', adminData);
          }
          if (adminData && (adminData.role === 'CONTENT_MANAGER' || adminData.role === 'SUPER_ADMIN')) {
            const adminWithTimestamps = {
              ...adminData,
              permissions: (adminData.permissions || []) as AdminPermission[],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            useAuthStore.getState().setCMSAdmin(adminWithTimestamps);
            if (adminData.permissions.length === 0 && adminData.role === 'CONTENT_MANAGER') {
              notify.info('No CMS permissions assigned. Contact your administrator to access features.');
            }
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useCMSAuth] Admin set successfully, role:', adminData.role);
            }
          } else {
            setCMSError('Access denied. Content Manager or Super Admin role required.');
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useCMSAuth] Access denied, redirecting to login');
            }
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/cms/login');
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (!isMounted) return;
          
          if (process.env.NODE_ENV !== 'production') {
            console.error('[useCMSAuth] Session verification error:', error);
          }
          
          // Handle authentication failures (clear session)
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Only show error and redirect if NOT on login page (expected post-logout state)
            if (pathname !== '/cms/login') {
              setCMSError('Session expired or access denied. Please login again.');
              setCMSAdmin(null);
              if (!redirectInitiated.current) {
                redirectInitiated.current = true;
                router.push('/cms/login');
              }
            } else {
              // On login page: silently ignore (user already at login, no action needed)
              if (process.env.NODE_ENV !== 'production') {
                console.log('[useCMSAuth] 401/403 on login page (expected post-logout), suppressing error');
              }
            }
            return;
          }
          
          // Handle transient errors (preserve session, show warning)
          if (error.response?.status >= 500 || error.code === 'ECONNREFUSED') {
            console.warn('[useCMSAuth] Transient error during verification, preserving session:', error.message);
            setCMSError(null); // Don't show error to user for transient issues
            // Keep cmsAdmin state intact - user can retry operations
            return;
          }
          
          // Unknown errors - clear session as fallback
          setCMSError(error.message || 'Session verification failed');
          if (!redirectInitiated.current) {
            redirectInitiated.current = true;
            router.push('/cms/login');
          }
        } finally {
          if (isMounted) {
            setCMSLoading(false);
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useCMSAuth] Session verification complete, loading set to false');
            }
          }
        }
      } else if (cmsAdmin && isMounted) {
        // Admin already exists, ensure loading is false
        if (isCMSLoading) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useCMSAuth] Admin already exists, setting loading to false');
          }
          setCMSLoading(false);
        }
      }
    };

    verifySession();
    
    return () => {
      isMounted = false; // Cleanup on unmount
    };
  }, [cmsAdmin, pathname, isLoggingOut]); // Re-run when session state changes

  // Check if user has required permissions
  const hasPermission = (permission: AdminPermission): boolean => {
    return cmsAdmin?.role === 'SUPER_ADMIN' || cmsAdmin?.permissions?.includes(permission) || false;
  };

  // Check if user is authenticated as Content Manager or Super Admin
  const isAuthenticated = cmsAdmin !== null && (cmsAdmin.role === 'CONTENT_MANAGER' || cmsAdmin.role === 'SUPER_ADMIN');

  // Separate flag for Super Admin status
  const isSuperAdmin = cmsAdmin?.role === 'SUPER_ADMIN';
  const adminRole = cmsAdmin?.role;

  return {
    cmsAdmin,
    adminRole,
    isAuthenticated,
    isSuperAdmin,
    isLoading: isCMSLoading,
    error: cmsError,
    cmsLogin,
    cmsVerifyOtp,
    cmsLogout,
    hasPermission,
  };
}