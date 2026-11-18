"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { useCMSAuth } from '@/hooks/use-cms-auth';
import CMSSidebar from '@/components/cms/sidebar';
import CMSHeader from '@/components/cms/header';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface CMSLayoutProps {
  children: React.ReactNode;
}

/**
 * CMS layout with authentication protection
 * Shared layout that wraps all CMS routes
 */
export default function CMSLayout({ children }: CMSLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const cmsAdmin = useAuthStore((state) => state.cmsAdmin);
  const isCMSLoading = useAuthStore((state) => state.isCMSLoading);
  const cmsLogout = useAuthStore((state) => state.cmsLogout);
  const setCMSAdmin = useAuthStore((state) => state.setCMSAdmin);
  const isCMSAdmin = cmsAdmin !== null;

  // Mobile/collapsed sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize CMS session from cookies
  useCMSAuth();

  // Client-side authentication check
  useEffect(() => {
    // Only redirect if loading is complete and user is not authenticated
    if (!isCMSAdmin && !isCMSLoading && pathname !== '/cms/login') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CMS Layout] Not authenticated, redirecting to login');
      }
      router.replace('/cms/login');
      return;
    }

    // Non-destructive guard: fix admin object shape if needed
    if (cmsAdmin && !Array.isArray(cmsAdmin.permissions)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[CMS Layout] CMS admin permissions not an array, setting default empty array');
      }
      setCMSAdmin({
        ...cmsAdmin,
        permissions: [],
      });
    }
  }, [isCMSAdmin, isCMSLoading, cmsAdmin, setCMSAdmin, router, pathname]);

  // Early return for login page (no auth checks, no loading spinner)
  // Hook clears admin state explicitly (setCMSAdmin(null)) to prevent stale state races
  if (pathname === '/cms/login') {
    return <>{children}</>;
  }

  // Show loading spinner while checking authentication
  if (isCMSLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show nothing while redirecting (for protected routes)
  if (!isCMSAdmin) {
    return null;
  }

  const sidebarWidth = isSidebarCollapsed ? "w-[68px]" : "w-64";
  const mainMargin = isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-64";

  // Render CMS pages
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Desktop Sidebar (fixed, hidden on mobile) */}
      <aside className={cn("fixed left-0 top-0 hidden h-screen border-r border-border lg:block transition-all duration-300 z-30", sidebarWidth)}>
        <CMSSidebar collapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar (Sheet drawer) */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <CMSSidebar onLinkClick={() => setIsMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", mainMargin)}>
        {/* Header */}
        <CMSHeader 
          onMenuClick={() => setIsMobileSidebarOpen(true)} 
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}