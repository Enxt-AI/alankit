import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getAllArticles, findArticleBySlug } from "@/lib/content-api";
import { articleUrl } from "@/lib/slugify";
import { JsonLd } from "@/components/seo/JsonLd";

interface ArticleDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { id: slug } = await params;
  
  let articleItem;
  try {
    const allArticles = await getAllArticles();
    articleItem = findArticleBySlug(allArticles, slug);
  } catch (e) {
    // ignore
  }

  const fallbackDescription = articleItem
    ? articleItem.content.replace(/<[^>]*>/g, "").slice(0, 150) + "..."
    : "Read the latest insights and analysis from UnlistedStox.";

  return constructMetadata(`/articles/${slug}`, {
    title: articleItem ? `${articleItem.title} | UnlistedStox Articles` : "Article | UnlistedStox",
    description: articleItem?.summary || fallbackDescription,
    image: articleItem?.imageUrl || undefined,
  });
}

export default async function ArticleDetailLayout({
  params,
  children,
}: {
  params: ArticleDetailPageProps["params"];
  children: React.ReactNode;
}) {
  const { id: slug } = await params;

  let articleItem;
  try {
    const allArticles = await getAllArticles();
    articleItem = findArticleBySlug(allArticles, slug);
  } catch {
    articleItem = null;
  }

  // Canonical URL comes from the CMS slug when set; otherwise the title-derived
  // slug, which is also what the route resolves.
  const canonicalPath = articleItem
    ? articleUrl(articleItem)
    : `/articles/${slug}`;
  const canonicalUrl = `https://www.unlistedstox.com${canonicalPath}`;

  const articleJsonLd = articleItem
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: articleItem.title,
        description: articleItem.summary || undefined,
        image: articleItem.imageUrl || undefined,
        datePublished: articleItem.createdAt,
        // Prefer the editorial review date: `updatedAt` changes on any DB write
        // (including cache-adjacent updates) and overstates freshness.
        dateModified:
          articleItem.contentReviewedAt ||
          articleItem.updatedAt ||
          articleItem.createdAt,
        author: articleItem.authorName
          ? {
              "@type": "Person",
              name: articleItem.authorName,
              jobTitle: articleItem.authorRole || undefined,
              description: articleItem.authorBio || undefined,
              url: canonicalUrl,
            }
          : { "@type": "Organization", name: "UnlistedStox" },
        publisher: {
          "@type": "Organization",
          name: "UnlistedStox",
          logo: {
            "@type": "ImageObject",
            url: "https://www.unlistedstox.com/icons/apple-touch-icon.png",
          },
        },
        mainEntityOfPage: canonicalUrl,
      }
    : null;

  const faqJsonLd =
    articleItem && articleItem.faqs && articleItem.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: articleItem.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }
      : null;

  return (
    <>
      {articleJsonLd && <JsonLd data={articleJsonLd} />}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      {children}
    </>
  );
}
