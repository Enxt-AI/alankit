"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import AccountingSidebar from "@/components/accounting/sidebar";
import AccountingHeader from "@/components/accounting/header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { verifyAccountingSession } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

interface AccountingLayoutProps {
  children: React.ReactNode;
}

export default function AccountingLayout({ children }: AccountingLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { 
    accountingAdmin, 
    isAccountingLoading, 
    setAccountingAdmin, 
    setAccountingLoading 
  } = useAuthStore();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize and verify session
  useEffect(() => {
    const checkSession = async () => {
      // Skip verification on login page to avoid infinite redirect/verification loops
      if (pathname === "/accounting/login") {
        setAccountingLoading(false);
        return;
      }

      if (!accountingAdmin) {
        setAccountingLoading(true);
        try {
          const admin = await verifyAccountingSession(pathname);
          if (admin) {
            setAccountingAdmin(admin);
          } else if (pathname !== "/accounting/login") {
            router.replace("/accounting/login");
          }
        } catch (error) {
          if (pathname !== "/accounting/login") {
            router.replace("/accounting/login");
          }
        } finally {
          setAccountingLoading(false);
        }
      }
    };

    checkSession();
  }, [accountingAdmin, pathname, router, setAccountingAdmin, setAccountingLoading]);

  // Public route handling
  if (pathname === "/accounting/login") {
    return <>{children}</>;
  }

  // Popup routes — render full-screen without sidebar/header
  const isPopupRoute = pathname.includes("/popup/");
  if (isPopupRoute && !isAccountingLoading && accountingAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="min-h-screen p-0">{children}</main>
      </div>
    );
  }

  // Loading state
  if (isAccountingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated redirect
  if (!accountingAdmin) {
    return null;
  }

  const sidebarWidth = isSidebarCollapsed ? "w-[68px]" : "w-64";
  const mainMargin = isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-64";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 hidden h-screen border-r bg-card lg:block transition-all duration-300 z-30",
          sidebarWidth
        )}
      >
        <AccountingSidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <AccountingSidebar onLinkClick={() => setIsMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", mainMargin)}>
        <AccountingHeader
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
