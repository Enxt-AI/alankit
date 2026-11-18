import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getAllNews } from "@/lib/content-api";
import { slugify } from "@/lib/slugify";
import { JsonLd } from "@/components/seo/JsonLd";

interface NewsDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: NewsDetailPageProps): Promise<Metadata> {
  const { id: slug } = await params;
  
  let newsItem;
  try {
    const allNews = await getAllNews();
    newsItem = allNews.find((n) => slugify(n.title) === slug);
  } catch (e) {
    // ignore
  }

  return constructMetadata(`/news/${slug}`, {
    title: newsItem ? `${newsItem.title} | UnlistedStox News` : "News | UnlistedStox",
    description: newsItem ? newsItem.content.replace(/<[^>]*>/g, "").slice(0, 150) + "..." : "Latest news and updates from UnlistedStox.",
    image: newsItem?.imageUrl || undefined,
  });
}

export default async function NewsDetailLayout({
  params,
  children,
}: {
  params: NewsDetailPageProps["params"];
  children: React.ReactNode;
}) {
  const { id: slug } = await params;

  let newsItem;
  try {
    const allNews = await getAllNews();
    newsItem = allNews.find((n) => slugify(n.title) === slug);
  } catch {
    newsItem = null;
  }

  const newsJsonLd = newsItem
    ? {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: newsItem.title,
        image: newsItem.imageUrl || undefined,
        datePublished: newsItem.createdAt,
        dateModified: newsItem.updatedAt || newsItem.createdAt,
        author: { "@type": "Organization", name: "UnlistedStox" },
        publisher: {
          "@type": "Organization",
          name: "UnlistedStox",
          logo: {
            "@type": "ImageObject",
            url: "https://www.unlistedstox.com/icons/apple-touch-icon.png",
          },
        },
        mainEntityOfPage: `https://www.unlistedstox.com/news/${slug}`,
      }
    : null;

  return (
    <>
      {newsJsonLd && <JsonLd data={newsJsonLd} />}
      {children}
    </>
  );
}
