import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unlisted Shares List",
  description: "Find unlisted shares price list in India that are available for Buy. Browse latest and upcoming pre-IPO stocks.",
};

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
