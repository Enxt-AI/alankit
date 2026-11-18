import type { Metadata } from "next";

import { constructMetadata } from "@/lib/seo-helper";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata("/baskets", {
    title: "Stock Baskets",
    description: "Diversify your portfolio with professionally managed baskets themed around high-growth sectors and institutional-grade strategies.",
  });
}

export default function BasketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
