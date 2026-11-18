import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllStocks, getAllUpcomingStocks } from "@/lib/stocks-api";
import { getAllNews, getAllArticles } from "@/lib/content-api";
import { getAllBaskets } from "@/lib/baskets-api";
import { getAllActiveStaticPages } from "@/lib/static-pages-api";
import { slugify } from "@/lib/slugify";
import { getStockSlug } from "@/lib/utils";

const rawBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://www.unlistedstox.com";
const baseUrl = rawBaseUrl.replace(/\/+$/, "");

const CMS_SLUG_MAP: Record<string, string> = {
  "about-us": "/about",
  "terms-and-conditions": "/legal-policies/terms-and-conditions",
  "privacy-policy": "/legal-policies/privacy-policy",
  "disclaimer": "/legal-policies/disclaimer",
  "cookie-policy": "/legal-policies/cookie-policy",
  "acceptable-use": "/legal-policies/acceptable-use",
  "refund-policy": "/legal-policies/refund-policy",
};

function safeDate(val: any): Date {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function urlSet(
  urls: Array<{
    url: string;
    lastModified: Date;
    changeFrequency: string;
    priority: number;
  }>
): string {
  const items = urls.map(
    (u) =>
      `  <url><loc>${u.url}</loc><lastmod>${u.lastModified.toISOString()}</lastmod><changefreq>${u.changeFrequency}</changefreq><priority>${u.priority}</priority></url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join(
    "\n"
  )}\n</urlset>`;
}

// Seconds. Stocks refresh most often (price syncs); legal pages least.
const REVALIDATE_BY_GROUP: Record<string, number> = {
  stocks: 300,
  news: 3600,
  articles: 3600,
  baskets: 3600,
  "upcoming-stocks": 3600,
  pages: 86400,
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ group: string }> }
): Promise<NextResponse> {
  const { group: rawGroup } = await context.params;

  // The sitemap index links to `/sitemaps/stocks.xml`, but the route segment
  // is `[group]`, so the value arrives as `stocks.xml`. Normalise it before
  // the lookup, otherwise every section falls through to `default` and
  // returns an empty <urlset>.
  const group = rawGroup.replace(/\.xml$/i, "");

  if (!(group in REVALIDATE_BY_GROUP)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const revalidate = REVALIDATE_BY_GROUP[group] ?? 3600;

  let urls: Array<{
    url: string;
    lastModified: Date;
    changeFrequency: string;
    priority: number;
  }> = [];

  try {
    switch (group) {
      case "stocks": {
        const stocks = await getAllStocks();
        urls = stocks
          .filter((s) => s.isActive !== false)
          .map((s) => ({
            url: `${baseUrl}/stocks/${getStockSlug(s)}`,
            lastModified: safeDate(s.updatedAt || s.createdAt),
            changeFrequency: "daily",
            priority: 0.85,
          }));
        break;
      }

      case "news": {
        const news = await getAllNews();
        urls = news
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            url: `${baseUrl}/news/${slugify(item.title)}`,
            lastModified: safeDate(item.updatedAt || item.createdAt),
            changeFrequency: "daily",
            priority: 0.75,
          }));
        break;
      }

      case "articles": {
        const articles = await getAllArticles();
        urls = articles
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            url: `${baseUrl}/articles/${item.slug || slugify(item.title)}`,
            lastModified: safeDate(item.contentReviewedAt || item.updatedAt || item.createdAt),
            changeFrequency: "daily",
            priority: 0.8,
          }));
        break;
      }

      case "baskets": {
        const baskets = await getAllBaskets();
        urls = baskets
          .filter(
            (b) =>
              b.resolvedStatus !== "CLOSED" && (b as any).status !== "INACTIVE"
          )
          .map((basket) => ({
            url: `${baseUrl}/baskets/${basket.slug || basket.id}`,
            lastModified: safeDate(basket.updatedAt),
            changeFrequency: "weekly",
            priority: 0.75,
          }));
        break;
      }

      case "upcoming-stocks": {
        const upcoming = await getAllUpcomingStocks();
        urls = upcoming
          .filter((s) => s.isActive !== false)
          .map((s) => ({
            url: `${baseUrl}/upcoming-stocks/${s.id}`,
            lastModified: safeDate(s.updatedAt || s.createdAt),
            changeFrequency: "weekly",
            priority: 0.7,
          }));
        break;
      }

      case "pages": {
        const staticRoutes = [
          { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
          { url: `${baseUrl}/stocks`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
          { url: `${baseUrl}/baskets`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
          { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
          { url: `${baseUrl}/articles`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
          { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
          { url: `${baseUrl}/contact-us`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
          { url: `${baseUrl}/supports`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
          { url: `${baseUrl}/unlisted-shares-price-list`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
          { url: `${baseUrl}/upcoming-stocks`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
          { url: `${baseUrl}/legal-policies`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
          { url: `${baseUrl}/legal-policies/terms-and-conditions`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
          { url: `${baseUrl}/legal-policies/privacy-policy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
          { url: `${baseUrl}/legal-policies/disclaimer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
          { url: `${baseUrl}/legal-policies/cookie-policy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
          { url: `${baseUrl}/legal-policies/acceptable-use`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
          { url: `${baseUrl}/legal-policies/refund-policy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
        ];

        let cmsPages: any[] = [];
        try {
          cmsPages = await getAllActiveStaticPages();
        } catch {
          cmsPages = [];
        }

        const cmsRoutes = (cmsPages as any[])
          .filter((page) => page.slug && page.isActive !== false)
          .map((page) => {
            const path =
              CMS_SLUG_MAP[page.slug] || `/legal-policies/${page.slug}`;
            return {
              url: `${baseUrl}${path}`,
              lastModified: safeDate(page.updatedAt || page.createdAt),
              changeFrequency: "monthly" as const,
              priority: 0.5,
            };
          });

        urls = [...staticRoutes, ...cmsRoutes];
        break;
      }

      default:
        urls = [];
    }
  } catch {
    urls = [];
  }

  // Deduplicate by URL (CMS pages may overlap static routes)
  const urlMap = new Map<string, typeof urls[number]>();
  for (const entry of urls) {
    urlMap.set(entry.url, entry);
  }
  const deduped = Array.from(urlMap.values());

  const xml = urlSet(deduped);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=${revalidate}, s-maxage=${revalidate}`,
    },
  });
}
