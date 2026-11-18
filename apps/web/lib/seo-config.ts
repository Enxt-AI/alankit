export interface SEOConfig {
  title: string;
  description: string;
}

export const SEO_ROUTES: Record<string, SEOConfig> = {
  "/": {
    title: "Invest in Pre-IPO & Unlisted Shares",
    description:
      "Discover curated pre-IPO investment opportunities. Buy unlisted shares from high-growth companies with secure off-market transfers, backed by SMC Group.",
  },
  "/stocks": {
    title: "Explore Unlisted Stocks",
    description:
      "Browse all available unlisted shares in India. Filter by popularity, price, and sector. Find your next pre-IPO investment opportunity.",
  },
  "/news": {
    title: "Market News",
    description:
      "Stay updated with the latest news about unlisted stocks, pre-IPO companies, and market insights curated by the UnlistedStox editorial team.",
  },
  "/articles": {
    title: "Articles & Insights",
    description:
      "In-depth analysis, expert reviews, and educational content on unlisted shares and pre-IPO investment opportunities from the UnlistedStox team.",
  },
  "/baskets": {
    title: "Investment Baskets",
    description:
      "Explore curated investment baskets of unlisted shares. Diversify your pre-IPO portfolio with professionally designed, sector-specific collections.",
  },
};
