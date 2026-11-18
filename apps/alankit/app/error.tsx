"use client";

import { useEffect } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StatusPageView } from "@/components/ui/status-feedback";

export default function ErrorPage({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />
      <StatusPageView
        code="500"
        title="Something went wrong on our end"
        description="We ran into an unexpected hiccup while loading this page. Your portfolio and account data are completely safe."
        suggestion="Please click 'Try Again' to reload the latest market data, or return to the home page."
        onRetry={handleRetry}
      />
      <Footer />
    </div>
  );
}

