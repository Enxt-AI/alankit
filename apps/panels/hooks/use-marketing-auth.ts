import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../store/auth-store';
import { verifyMarketingSession } from '../lib/auth-api';

/**
 * Marketing authentication hook with session verification
 *
 * Features:
 * - Automatic session verification on mount/route change via direct backend calls
 * - Skips verification during active logout (prevents 401 errors)
 * - Redirects to login if session invalid
 * - Cookies are read from localhost:3003 domain in development
 *
 * @returns Marketing admin state, loading state, and auth actions
 */
export const useMarketingAuth = () => {
  const router = useRouter();
  const pathname = usePathname();
  const redirectInitiated = useRef(false); // Prevent multiple redirects
  const [isVerifying, setIsVerifying] = useState(false); // Track active verification
  const {
    marketingAdmin,
    isMarketingLoading,
    marketingError,
    marketingLogin,
    marketingLogout,
    setMarketingLoading,
    setMarketingError,
    setMarketingAdmin,
    isLoggingOutMarketing,
  } = useAuthStore();

  // Verify marketing session on mount
  useEffect(() => {
    // Reset redirect flag when admin state changes
    redirectInitiated.current = false;

    let isMounted = true; // Prevent state updates after unmount

    const verifySession = async () => {
      // Skip verification if we're on the login page (prevent timeout race, preserve login state)
      if (pathname === '/marketing/login') {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useMarketingAuth] On login page, skipping session verification');
        }
        setMarketingLoading(false);
        setMarketingError(null);
        // Reset local verifying flag: a previous in-flight verification may have
        // set isVerifying=true before pathname flipped to /marketing/login, and its
        // cleanup (isMounted=false) prevents its finally from clearing it — leaving
        // the layout stuck on "Verifying authentication..." until refresh.
        setIsVerifying(false);
        // No setMarketingAdmin(null) - preserve login-set state for redirect
        return;
      }

      // Skip verification during logout to prevent 401 errors
      if (isLoggingOutMarketing) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useMarketingAuth] Logout in progress, skipping session verification');
        }
        setMarketingLoading(false);
        return;
      }

      if (!marketingAdmin && isMounted) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useMarketingAuth] No admin found, starting session verification');
        }
        setMarketingLoading(true);
        setIsVerifying(true);

        const timeoutId = setTimeout(() => {
          if (isMounted && process.env.NODE_ENV !== 'production') {
            console.log('[useMarketingAuth] Verification timeout reached, setting loading to false');
          }
          if (isMounted) {
            setMarketingLoading(false);
            setIsVerifying(false);
            setMarketingError('Session verification timeout');
            setMarketingAdmin(null); // Clear session on timeout
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/marketing/login');
            }
          }
        }, 5000); // 5 second timeout (reduced from 15s)

        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[useMarketingAuth] Calling verifyMarketingSession...');
          }
          const adminData = await verifyMarketingSession(pathname);
          clearTimeout(timeoutId); // Clear timeout on success

          if (!isMounted) return; // Component unmounted

          if (process.env.NODE_ENV !== 'production') {
            console.log('[useMarketingAuth] verifyMarketingSession returned:', adminData);
          }
          if (adminData) {
            const adminWithTimestamps = {
              ...adminData,
              createdAt: adminData.createdAt || new Date().toISOString(),
              updatedAt: adminData.updatedAt || new Date().toISOString(),
            };
            useAuthStore.getState().setMarketingAdmin(adminWithTimestamps);
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useMarketingAuth] Admin set successfully');
            }
          } else {
            setMarketingError('Access denied. Marketing Manager role required.');
            if (process.env.NODE_ENV !== 'production') {
              console.log('[useMarketingAuth] Access denied, redirecting to login');
            }
            if (!redirectInitiated.current) {
              redirectInitiated.current = true;
              router.push('/marketing/login');
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (!isMounted) return;

          if (process.env.NODE_ENV !== 'production') {
            console.error('[useMarketingAuth] Session verification error:', error);
          }

          // Handle authentication failures (clear session and cookie)
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Clear both store and error state
            setMarketingAdmin(null);
            // Only show error and redirect if NOT on login page (expected post-logout state)
            if (pathname !== '/marketing/login') {
              setMarketingError('Session expired or access denied. Please login again.');
              if (!redirectInitiated.current) {
                redirectInitiated.current = true;
                router.push('/marketing/login');
              }
            } else {
              // On login page: silently ignore (user already at login, expected post-logout)
              if (process.env.NODE_ENV !== 'production') {
                console.log('[useMarketingAuth] 401/403 on login page (expected post-logout), suppressing error');
              }
            }
            return;
          }

          // Handle server errors (log warning, preserve session)
          if (error.response?.status >= 500 || error.code === 'ECONNREFUSED') {
            console.warn('[useMarketingAuth] Server error during verification, preserving session:', error.message);
            setMarketingError(null); // Don't show error to user for transient issues
            // Keep marketingAdmin state intact - user can retry operations
            return;
          }

          // Unknown errors (network, timeout, etc.) - show error but stay on page
          console.error('[useMarketingAuth] Unknown error during verification:', error.message);
          setMarketingError('Failed to verify session. Please try refreshing the page.');
          // Preserve session - user may want to retry before logging out
        } finally {
          if (isMounted) {
            setMarketingLoading(false);
            setIsVerifying(false);
          }
        }
      } else if (marketingAdmin) {
        // Admin already loaded, just mark as done
        if (process.env.NODE_ENV !== 'production') {
          console.log('[useMarketingAuth] Admin already present, skipping verification');
        }
        setMarketingLoading(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false; // Mark component as unmounted
    };
  }, [pathname, marketingAdmin, isLoggingOutMarketing, router, setMarketingLoading, setMarketingError, setMarketingAdmin]);

  return {
    marketingAdmin,
    isMarketingLoading,
    isVerifying,
    marketingError,
    isAuthenticated: !!marketingAdmin,
    marketingLogin,
    marketingLogout,
  };
};