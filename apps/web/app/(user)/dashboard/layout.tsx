"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { Loader2 } from "lucide-react";

/**
 * Dashboard Layout
 * 
 * Shared layout for all authenticated dashboard pages.
 * Provides navigation via Navbar and authentication check.
 * 
 * Protected by middleware, but provides client-side check for better UX.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  // Client-side authentication check (redundant with middleware, but provides better UX)
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Dashboard Layout] User not authenticated, redirecting to landing');
      }
      router.replace('/'); // Use replace to avoid adding to history
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full flex-1 flex flex-col">
      {children}
      <UpdatePrompt />
    </div>
  );
}
