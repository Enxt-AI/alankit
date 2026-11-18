"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RegulatoryDisclaimerModal } from "@/components/layout/RegulatoryDisclaimerModal";
import { BrowserLocationRequester } from "@/components/layout/BrowserLocationRequester";

// NOTE: GoogleOAuthProvider removed — authentication now uses email OTP flow.
// Create the QueryClient lazily (per SSR request on the server, per mount on
// the client) instead of at module scope. A module-scope instance would be
// shared across concurrent server requests and can leak cached query data
// between users.
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes - matches backend Redis cache
        gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
        refetchOnWindowFocus: false, // Avoid unnecessary refetches on tab switch
        retry: 1, // Retry failed requests once
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <BrowserLocationRequester />
      <RegulatoryDisclaimerModal />
    </QueryClientProvider>
  );
}
