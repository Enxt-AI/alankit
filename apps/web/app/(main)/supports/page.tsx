import type { Metadata } from "next";
import { SupportClient } from "./support-client";

export const metadata: Metadata = {
  title: "Support Center",
  description:
    "Need help? Browse our FAQs, submit a support ticket, or contact our team for assistance with your UnlistedStox account and investments.",
};

export default function SupportPage() {
  return <SupportClient />;
}
