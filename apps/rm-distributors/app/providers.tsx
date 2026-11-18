"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";

export function Providers({ children }: { children: React.ReactNode }) {
  useIdleTimeout(); // Auto-logout after 10 min of inactivity (mouse, keyboard, scroll, touch)

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute stale time
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
