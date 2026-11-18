import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Metadata lives here, not in `page.tsx`, because the page is a Client
 * Component ("use client") and Next.js only resolves metadata on the server.
 */
export const metadata: Metadata = {
  title: "Payment Success | UnlistedStox",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentESignSuccessLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
