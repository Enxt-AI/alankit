'use client';

import { useState, useEffect, startTransition, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMarketingAuth } from '@/hooks/use-marketing-auth';
import { Loader2 } from 'lucide-react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMarketingLoading, isVerifying, isAuthenticated } = useMarketingAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const hasRedirected = useRef(false);

  const isBypassRoute =
    pathname === '/marketing/login' ||
    pathname === '/marketing/promotions/sales-popup' ||
    pathname?.endsWith('/sales-popup');

  // 3s layout-level timeout to prevent infinite loading
  // Skip when on bypass routes (login page or standalone popup pages)
  useEffect(() => {
    if (isBypassRoute) return;
    if (isMarketingLoading && pathname !== '/marketing/login') {
      const timeoutId = setTimeout(() => {
        console.warn('[MarketingLayout] 3s loading timeout reached, forcing redirect');
        setLoadingTimeout(true);
        setShouldRedirect(true);
      }, 3000); // 3 second safety timeout

      return () => clearTimeout(timeoutId);
    }
  }, [isMarketingLoading, pathname, isBypassRoute]);

  // Allow future redirects after the user lands on login
  useEffect(() => {
    if (pathname === '/marketing/login' || isBypassRoute) {
      hasRedirected.current = false;
      setShouldRedirect(false);
      setLoadingTimeout(false);
    }
  }, [pathname, isBypassRoute]);

  // Handle redirect to login when not authenticated (in useEffect to avoid render-phase updates)
  useEffect(() => {
    if (isBypassRoute) return;
    if (!isAuthenticated && pathname !== '/marketing/login' && !isMarketingLoading && !hasRedirected.current) {
      setShouldRedirect(true);
    }
  }, [isAuthenticated, pathname, isMarketingLoading, isBypassRoute]);

  // Perform the actual redirect in a separate useEffect
  useEffect(() => {
    if (isBypassRoute) return;
    if (shouldRedirect && !hasRedirected.current) {
      hasRedirected.current = true;
      startTransition(() => {
        router.push('/marketing/login');
      });
    }
  }, [shouldRedirect, router, isBypassRoute]);

  // If on bypass route (login or sales-popup), render directly without layout blocking
  if (isBypassRoute) {
    return <>{children}</>;
  }

  // Show loading spinner during authentication verification
  // Never block the login page itself: it skips session verification, so any
  // stale isMarketingLoading/isVerifying flag would otherwise trap users on
  // "Verifying authentication..." until they manually refresh.
  if ((isMarketingLoading || isVerifying) && pathname !== '/marketing/login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-300">Verifying authentication...</p>
          {loadingTimeout && (
            <p className="text-sm text-red-400 mt-2">
              Taking longer than expected. Please refresh if this persists.
            </p>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated and not on login page, the redirect will happen above
  // If authenticated or on login page, render children
  return <>{children}</>;
}