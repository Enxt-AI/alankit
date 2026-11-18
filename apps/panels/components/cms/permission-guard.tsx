import { ReactNode } from 'react';
import { useCMSAuth } from '../../hooks/use-cms-auth';
import { AlertTriangle } from 'lucide-react';
import { AdminPermission } from '../../types/admin';

interface PermissionGuardProps {
  requiredPermissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ requiredPermissions, children, fallback }: PermissionGuardProps) {
  const { hasPermission, isAuthenticated, isLoading, adminRole } = useCMSAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16A34A]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        className="flex items-center space-x-4 p-6 bg-white border border-red-100 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
      >
        <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0" />
        <div>
          <h3 className="text-base font-bold text-red-800">Access Denied</h3>
          <p className="text-xs font-semibold text-red-600/90 mt-0.5">You must be logged in as a Content Manager to access this page.</p>
        </div>
      </div>
    );
  }

  // SUPER_ADMIN bypasses all permission checks
  if (adminRole === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Check if user has all required permissions
  const hasAllPermissions = requiredPermissions.every(permission => hasPermission(permission as AdminPermission));

  if (!hasAllPermissions) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div 
        className="flex items-center space-x-4 p-6 bg-white border border-amber-100 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
      >
        <AlertTriangle className="h-8 w-8 text-amber-600 flex-shrink-0" />
        <div>
          <h3 className="text-base font-bold text-amber-800">Permission Denied</h3>
          <p className="text-xs font-semibold text-amber-600/90 mt-0.5">You don't have the required permissions to access this feature.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}