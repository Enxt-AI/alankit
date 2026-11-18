import { NextResponse } from "next/server";

const rawBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://www.unlistedstox.com";
const baseUrl = rawBaseUrl.replace(/\/+$/, "");

/**
 * Sitemap index.
 *
 * References per-section sitemaps so a slow crawl of one section (e.g. stocks)
 * never delays discovery of another (e.g. articles). Each section sets its own
 * Cache-Control via its route handler.
 */
export const dynamic = "force-dynamic";
export const revalidate = 86400; // 24 hours

const GROUPS = [
  "stocks",
  "news",
  "articles",
  "baskets",
  "upcoming-stocks",
  "pages",
] as const;

export async function GET() {
  const sitemaps = GROUPS.map((g) => ({
    url: `${baseUrl}/sitemaps/${g}.xml`,
    lastModified: new Date().toISOString(),
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (s) =>
      `  <sitemap><loc>${s.url}</loc><lastmod>${s.lastModified}</lastmod></sitemap>`
  )
  .join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
