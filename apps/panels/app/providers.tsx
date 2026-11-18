"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "../components/ui/floating-notification";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";

// Create QueryClient instance with configured defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - matches backend Redis cache
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
      refetchOnWindowFocus: false, // Avoid unnecessary refetches on tab switch
      retry: 1, // Retry failed requests once
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useIdleTimeout(); // Auto-logout after 10 min of inactivity (mouse, keyboard, scroll, touch)

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NotificationProvider />
    </QueryClientProvider>
  );
}

