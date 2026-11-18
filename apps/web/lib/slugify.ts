/**
 * Generates a URL-friendly slug from a string.
 * Example: "Market Update: Unlisted Stocks Surge in Q4 2025" → "market-update-unlisted-stocks-surge-in-q4-2025"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // remove non-word chars (except spaces & hyphens)
    .replace(/\s+/g, "-")       // spaces → hyphens
    .replace(/-+/g, "-")        // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");   // trim leading/trailing hyphens
}

/**
 * Builds a news article URL from its title.
 */
export function newsUrl(title: string): string {
  return `/news/${slugify(title)}`;
}

/**
 * Builds an article URL.
 *
 * Accepts the article object so an explicit CMS slug wins over the
 * title-derived slug. A plain string still works (legacy callers) and is
 * slugified as before.
 */
export function articleUrl(
  article: string | { slug?: string | null; title: string },
): string {
  if (typeof article === "string") {
    return `/articles/${slugify(article)}`;
  }
  return `/articles/${article.slug || slugify(article.title)}`;
}
