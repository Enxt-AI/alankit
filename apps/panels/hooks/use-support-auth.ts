import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useSupportAdmin } from '../store/auth-store';
import { verifySupportSession } from '../lib/auth-api';
import type { AdminPermission } from '../types/admin';

/**
 * Support authentication hook with session verification
 *
 * Features:
 * - Automatic session verification on mount/route change via direct backend calls
 * - Skips verification during active logout (prevents 401 errors)
 * - Redirects to login if session invalid
 * - Provides permission checking utilities
 * - Cookies are read from localhost:3003 domain in development
 *
 * @returns Support admin state, loading state, and auth actions
 */
export const useSupportAuth = () => {
  const router = useRouter();
  const pathname = usePathname();
  const redirectInitiated = useRef(false); // Prevent multiple redirects
  const {
    supportAdmin,
    isSupportLoading,
    supportError,
    supportLogin,
    supportLogout,
    setSupportLoading,
    setSupportError,
    setSupportAdmin,
    isLoggingOutSupport,
  } = useAuthStore();

  // Verify Support session on mount
  useEffect(() => {
    // Reset redirect flag when admin state changes
    redirectInitiated.current = false;

    let isMounted = true; // Prevent state updates after unmount

    const verifySession = async () => {
      // Skip verification if we're on the login page (prevent timeout race, preserve login state)
      if (pathname === '/support/login') {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useSupportAuth] On login page, skipping session verification');
        }
        setSupportLoading(false);
        setSupportError(null);
        // No setSupportAdmin(null) - preserve login-set state for redirect
        return;
      }

      // Skip verification during logout to prevent 401 errors
      if (isLoggingOutSupport) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useSupportAuth] Logout in progress, skipping session verification');
        }
        setSupportLoading(false);
        return;
      }

      if (!supportAdmin && isMounted) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useSupportAuth] No admin found, starting session verification');
        }
        setSupportLoading(true);

        const timeoutId = setTimeout(() => {
          if (isMounted && process.env.NODE_ENV !== 'production') {
            console.log('[useSupportAuth] Verification timeout reached, setting loading to false');
          }
          if (isMounted) {
            setSupportLoading(false);
            setSupportError('Session verification timeout');
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/support/login');
            }
          }
        }, 15000); // 15 second timeout

        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useSupportAuth] Calling verifySupportSession...');
          }
          const adminData = await verifySupportSession(pathname);
          clearTimeout(timeoutId); // Clear timeout on success

          if (!isMounted) return; // Component unmounted

          if (process.env.NODE_ENV !== 'production') {
            console.log('[useSupportAuth] verifySupportSession returned:', adminData);
          }
          if (adminData && (adminData.role === 'SUPPORT_AGENT' || adminData.role === 'SUPER_ADMIN')) {
            const adminWithTimestamps = {
              ...adminData,
              permissions: (adminData.permissions || []) as AdminPermission[],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            useAuthStore.getState().setSupportAdmin(adminWithTimestamps);
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useSupportAuth] Admin set successfully, role:', adminData.role);
            }
          } else {
            setSupportError('Access denied. Support Agent or Super Admin role required.');
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useSupportAuth] Access denied, redirecting to login');
            }
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/support/login');
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (!isMounted) return;

          if (process.env.NODE_ENV !== 'production') {
            console.error('[useSupportAuth] Session verification error:', error);
          }

          // Handle authentication failures (clear session)
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Only show error and redirect if NOT on login page (expected post-logout state)
            if (pathname !== '/support/login') {
              setSupportError('Session expired or access denied. Please login again.');
              setSupportAdmin(null);
              if (!redirectInitiated.current) {
                redirectInitiated.current = true;
                router.push('/support/login');
              }
            } else {
              // On login page: silently ignore (user already at login, expected post-logout)
              if (process.env.NODE_ENV !== 'production') {
                console.log('[useSupportAuth] 401/403 on login page (expected post-logout), suppressing error');
              }
            }
            return;
          }

          // Handle transient errors (preserve session, show warning)
          if (error.response?.status >= 500 || error.code === 'ECONNREFUSED') {
            console.warn('[useSupportAuth] Transient error during verification, preserving session:', error.message);
            setSupportError(null); // Don't show error to user for transient issues
            // Keep supportAdmin state intact - user can retry operations
            return;
          }

          // Unknown errors - clear session as fallback
          setSupportError(error.message || 'Session verification failed');
          if (!redirectInitiated.current) {
            redirectInitiated.current = true;
            router.push('/support/login');
          }
        } finally {
          if (isMounted) {
            setSupportLoading(false);
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useSupportAuth] Session verification complete, loading set to false');
            }
          }
        }
      } else if (supportAdmin && isMounted) {
        // Admin already exists, ensure loading is false
        if (isSupportLoading) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useSupportAuth] Admin already exists, setting loading to false');
          }
          setSupportLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false; // Cleanup on unmount
    };
  }, [supportAdmin, pathname, isLoggingOutSupport]); // Re-run when session state changes

  // Check if user has required permissions
  const hasPermission = (permission: AdminPermission) => {
    if (supportAdmin?.role === 'SUPER_ADMIN') return true;
    return supportAdmin?.permissions?.includes(permission) || false;
  };

  // Check if user has any of the required permissions
  const hasAnyPermission = (permissions: AdminPermission[]) => {
    if (supportAdmin?.role === 'SUPER_ADMIN') return true;
    return permissions.some(permission => hasPermission(permission));
  };

  // Check if user has all of the required permissions
  const hasAllPermissions = (permissions: AdminPermission[]) => {
    if (supportAdmin?.role === 'SUPER_ADMIN') return true;
    return permissions.every(permission => hasPermission(permission));
  };

  return {
    supportAdmin,
    isSupportLoading,
    supportError,
    isAuthenticated: !!supportAdmin,
    supportLogin,
    supportLogout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
};