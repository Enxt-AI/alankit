'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { verifyAdminSession } from '@/lib/auth-api';
import { Admin, AdminPermission } from '@/types/admin';

/**
 * Custom hook for admin authentication management
 * Restores admin session from HttpOnly cookie via direct backend verification
 * Cookies are read from localhost:3003 domain in development
 */
export function useAdminAuth() {
  const { admin, isAdminLoading, isLoggingOutAdmin, setAdmin, setAdminLoading, adminLogout } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Avoid session verification during logout/redirect.
    if (isLoggingOutAdmin || pathname === '/admin/login') {
      setAdminLoading(false);
      return;
    }

    // Skip verification if admin is already authenticated (just logged in)
    if (admin && admin.id) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Admin Auth] Admin already authenticated, skipping verification');
      }
      setAdminLoading(false); // Ensure loading is false
      return;
    }

    // Set loading state at the very beginning
    setAdminLoading(true);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Admin Auth] Starting admin session restoration');
    }

    // Verify admin session via backend (reads HttpOnly cookie)
    const restoreSession = async () => {
      try {
        const adminData = await verifyAdminSession();

        if (!adminData) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[Admin Auth] No valid admin session found');
          }
          setAdminLoading(false);
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Admin Auth] Admin session valid, restoring...');
        }

        // Construct Admin object from backend response
        const adminUser: Admin = {
          id: adminData.id,
          email: adminData.email,
          fullName: adminData.fullName,
          role: adminData.role,
          permissions: (adminData.permissions || []) as AdminPermission[],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Populate auth store with admin data
        setAdmin(adminUser);
        setAdminLoading(false);

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Admin Auth] Admin session restored:', {
            email: adminUser.email,
            role: adminUser.role,
            permissions: adminUser.permissions.length,
          });
        }
      } catch (error: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Admin Auth] Error restoring admin session:', error);
        }
        
        // Handle authentication failures (clear session)
        if (error.response?.status === 401 || error.response?.status === 403) {
          adminLogout();
          setAdminLoading(false);
          return;
        }
        
        // Handle transient errors (preserve session, show warning)
        if (error.response?.status >= 500 || error.code === 'ECONNREFUSED') {
          console.warn('[Admin Auth] Transient error during verification, preserving session:', error.message);
          // Keep admin state intact - user can retry operations
          setAdminLoading(false);
          return;
        }
        
        // For other errors, still logout as fallback
        adminLogout();
        setAdminLoading(false);
      }
    };

    // Safety timeout: Never leave isAdminLoading true indefinitely if network stalls
    const safetyTimer = setTimeout(() => {
      if (useAuthStore.getState().isAdminLoading) {
        setAdminLoading(false);
      }
    }, 4000);

    restoreSession();

    return () => clearTimeout(safetyTimer);
  }, [admin, isLoggingOutAdmin, pathname, setAdmin, setAdminLoading, adminLogout]);

  const checkPermission = (permission: string): boolean => {
    return admin?.permissions?.includes(permission as AdminPermission) ?? false;
  };

  return { admin, isAdminLoading, adminLogout, checkPermission };
}
