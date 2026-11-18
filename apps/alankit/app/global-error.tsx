"use client";

import { StatusPageView } from "@/components/ui/status-feedback";
import "./globals.css";

export default function GlobalError({
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  const handleRetry = () => {
    if (retry) {
      retry();
    } else if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white font-sans antialiased">
        <StatusPageView
          code="503"
          title="Service temporarily unavailable"
          description="Our market data servers are currently undergoing a quick refresh. Please try again in a few moments."
          onRetry={handleRetry}
        />
      </body>
    </html>
  );
}

