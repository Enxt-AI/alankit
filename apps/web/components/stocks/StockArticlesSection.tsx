"use client";

/**
 * StockArticlesSection
 *
 * Card-contained "Expert Insights & Analysis" feed for the stock detail page.
 * Shares layout primitives with StockNewsSection, rendered with the blue
 * article theme and /articles routing.
 */

import type { Article } from "@/types/content";
import { StockNewsSection } from "@/components/stocks/StockNewsSection";

interface StockArticlesSectionProps {
  articles?: Article[];
  isLoading?: boolean;
  stockName?: string;
  maxItems?: number;
}

export function StockArticlesSection({ articles, isLoading, stockName, maxItems = 5 }: StockArticlesSectionProps) {
  return (
    <StockNewsSection
      type="article"
      news={articles}
      isLoading={isLoading}
      stockName={stockName}
      maxItems={maxItems}
    />
  );
}

export default StockArticlesSection;
