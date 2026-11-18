"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import AdminSidebar from "@/components/admin/sidebar";
import AdminHeader from "@/components/admin/header";
import { cn } from "@/lib/utils";

import { Sheet, SheetContent } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const admin = useAuthStore((state) => state.admin);
  const isAdminLoading = useAuthStore((state) => state.isAdminLoading);
  const isAdmin = admin !== null;

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialize admin session from cookies
  useAdminAuth();

  const isBypassRoute =
    pathname === "/admin/login" ||
    pathname === "/admin/branches/sales-popup" ||
    pathname === "/admin/distributors/sales-popup" ||
    pathname === "/admin/relationship-managers/sales-popup" ||
    pathname === "/admin/promotions/sales-popup" ||
    pathname?.endsWith("/sales-popup");

  // Client-side authentication check
  useEffect(() => {
    if (isBypassRoute) return;

    if (!isAdminLoading) {
      if (!isAdmin) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[Admin Layout] Not authenticated, redirecting to login");
        }
        router.replace("/admin/login");
        return;
      }

      if (admin && admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN") {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[Admin Layout] Insufficient role (${admin.role}), redirecting to login`);
        }
        useAuthStore.getState().setAdmin(null);
        router.replace("/admin/login");
        return;
      }
    }
  }, [isAdmin, isAdminLoading, admin, router, isBypassRoute]);

  if (isBypassRoute) {
    return <>{children}</>;
  }


  if (isAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const sidebarWidth = isSidebarCollapsed ? "w-[68px]" : "w-[272px]";
  const mainMargin = isSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[272px]";

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Desktop Sidebar */}
      <aside className={cn("fixed left-0 top-0 hidden h-screen border-r border-neutral-200/30 bg-white lg:block transition-all duration-300 z-30", sidebarWidth)}>
        <AdminSidebar collapsed={isSidebarCollapsed} />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-[272px] p-0">
          <AdminSidebar onLinkClick={() => setIsMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", mainMargin)}>
        <AdminHeader 
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
        <main className="flex-1 px-8 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

