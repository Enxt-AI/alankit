'use client';

import { useState, useEffect, startTransition, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupportAuth } from '@/hooks/use-support-auth';
import { SupportSidebar } from '@/components/support/sidebar';
import { SupportHeader } from '@/components/support/header';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSupportLoading, isAuthenticated } = useSupportAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const hasRedirected = useRef(false);

  // Handle navigation after render to avoid React state update errors
  useEffect(() => {
    if (shouldRedirect) {
      startTransition(() => {
        router.push('/support/login');
      });
    }
  }, [shouldRedirect]); // Removed router from dependencies

  // Show loading spinner while verifying authentication
  if (isSupportLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#16A34A]" />
          <p className="text-sm font-semibold text-[#64748B]">Loading support panel...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated && pathname !== '/support/login' && !hasRedirected.current) {
    hasRedirected.current = true;
    setShouldRedirect(true);
    return null;
  }

  // Don't show layout on login page
  if (pathname === '/support/login') {
    return <>{children}</>;
  }

  const mainPaddingLeft = isSidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64";

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative selection:bg-[#16A34A]/10 selection:text-[#16A34A]">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(16,185,129,0.03),transparent_70%)]" />
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <SupportSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={isSidebarCollapsed}
      />

      {/* Main content */}
      <div className={cn("transition-all duration-300", mainPaddingLeft)}>
        {/* Header */}
        <SupportHeader 
          onMenuClick={() => setSidebarOpen(true)} 
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Page content */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
