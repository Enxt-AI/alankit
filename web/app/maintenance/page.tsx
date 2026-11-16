"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StatusPageView } from "@/components/ui/status-feedback";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans">
      <Header />
      <StatusPageView
        code="503"
        title="Market feed temporarily unavailable"
        description="We are currently performing scheduled maintenance on our live exchange data feed to ensure accurate real-time pricing."
        suggestion="Normal trading and live quotes will resume shortly. Thank you for your patience!"
        onRetry={() => window.location.reload()}
      />
      <Footer />
    </div>
  );
}

