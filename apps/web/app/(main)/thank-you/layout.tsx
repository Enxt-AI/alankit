import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Thank You for Your Order | UnlistedStox",
  description: "Your investment order has been confirmed. Thank you for investing with UnlistedStox.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

