"use client";

import { usePathname, useParams } from "next/navigation";
import { SEO_ROUTES } from "@/lib/seo-config";
import { useStocks } from "@/hooks/use-stocks";
import { useNews, useArticles } from "@/hooks/use-content";
import { useBaskets } from "@/hooks/use-baskets";
import { slugify } from "@/lib/slugify";
import { useMemo } from "react";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * Global component that handles Breadcrumb JSON-LD dynamically based on the current route.
 */
export function GlobalSEO() {
  const pathname = usePathname();
  const params = useParams();

  // Data for dynamic lookups
  const { data: allStocks } = useStocks();
  const { data: allNews } = useNews();
  const { data: allArticles } = useArticles();
  const { data: allBaskets } = useBaskets();

  // Identify dynamic entities
  const stock = useMemo(() => {
    if (!params.id || !allStocks || !pathname.includes("/stocks/")) return null;
    const decodedId = decodeURIComponent(params.id as string);
    return allStocks.find((s) => s.name === decodedId || s.id === decodedId);
  }, [allStocks, params.id, pathname]);

  const newsItem = useMemo(() => {
    if (!params.id || !allNews || !pathname.includes("/news/")) return null;
    return allNews.find((n) => slugify(n.title) === params.id);
  }, [allNews, params.id, pathname]);

  const articleItem = useMemo(() => {
    if (!params.id || !allArticles || !pathname.includes("/articles/"))
      return null;
    return allArticles.find((a) => slugify(a.title) === params.id);
  }, [allArticles, params.id, pathname]);

  const basketItem = useMemo(() => {
    if (!params.id || !allBaskets || !pathname.includes("/baskets/"))
      return null;
    return allBaskets.find((b) => b.id === params.id);
  }, [allBaskets, params.id, pathname]);



  // ── BreadcrumbList JSON-LD ──
  const breadcrumbLd = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const items = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.unlistedstox.com",
      },
    ];

    let path = "";
    segments.forEach((seg, i) => {
      path += `/${seg}`;
      // Use the entity name for the last segment if available
      let name = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
      if (i === segments.length - 1) {
        if (stock) name = stock.name;
        else if (newsItem) name = newsItem.title;
        else if (articleItem) name = articleItem.title;
        else if (basketItem) name = basketItem.name;
      }
      items.push({
        "@type": "ListItem",
        position: i + 2,
        name,
        item: `https://www.unlistedstox.com${path}`,
      });
    });

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    };
  }, [pathname, stock, newsItem, articleItem, basketItem]);

  return (
    <>
      {breadcrumbLd && <JsonLd data={breadcrumbLd} />}
    </>
  );
}
