import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata("/articles", {
    title: "Articles & Insights",
    description: "Stay informed with our latest insights, market analysis, and educational content on unlisted shares and pre-IPO investments.",
  });
}

export default function ArticlesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
