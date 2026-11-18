"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import OperationHeader from "@/components/operation/header";
import OperationSidebar from "@/components/operation/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { verifyOperationSession } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

interface OperationLayoutProps {
  children: React.ReactNode;
}

export default function OperationLayout({ children }: OperationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { 
    operationAdmin, 
    isOperationLoading, 
    setOperationAdmin, 
    setOperationLoading 
  } = useAuthStore();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize and verify session
  useEffect(() => {
    const checkSession = async () => {
      // Skip verification on login page to avoid infinite redirect/verification loops
      if (pathname === "/operation/login") {
        setOperationLoading(false);
        return;
      }

      if (!operationAdmin) {
        setOperationLoading(true);
        try {
          const admin = await verifyOperationSession(pathname);
          if (admin) {
            setOperationAdmin(admin);
          } else if (pathname !== "/operation/login") {
            router.replace("/operation/login");
          }
        } catch (error) {
          if (pathname !== "/operation/login") {
            router.replace("/operation/login");
          }
        } finally {
          setOperationLoading(false);
        }
      }
    };

    checkSession();
  }, [operationAdmin, pathname, router, setOperationAdmin, setOperationLoading]);

  // Public route handling
  if (pathname === "/operation/login") {
    return <>{children}</>;
  }

  // Loading state
  if (isOperationLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
      </div>
    );
  }

  // Not authenticated redirect
  if (!operationAdmin) {
    return null;
  }

  const sidebarWidth = isSidebarCollapsed ? "w-[68px]" : "w-64";
  const mainMargin = isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-64";

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-[#0F172A]">
      {/* Desktop Sidebar (fixed, hidden on mobile) */}
      <aside className={cn("fixed left-0 top-0 hidden h-screen border-r border-neutral-200/30 lg:block transition-all duration-300 z-30", sidebarWidth)}>
        <OperationSidebar collapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar (Sheet drawer) */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <OperationSidebar onLinkClick={() => setIsMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", mainMargin)}>
        {/* Header */}
        <OperationHeader 
          onMenuClick={() => setIsMobileSidebarOpen(true)} 
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        
        {/* Main Content */}
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}

