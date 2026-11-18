"use client";

/**
 * PublicArticlesGrid Component
 *
 * Public-facing articles grid for landing page
 * Displays 4 latest active articles in 2x2 grid layout
 */

import { useRouter } from "next/navigation";
import { usePublicArticles } from "@/hooks/use-content";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentCard } from "@/components/content/content-card";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import { articleUrl } from "@/lib/slugify";
import type { Article } from "@/types/content";

export function PublicArticlesGrid() {
  const router = useRouter();
  const { data, isLoading, error } = usePublicArticles();

  // Limit to 4 items for 2x2 grid
  const displayArticles = (data || []).slice(0, 4);

  // Loading state - 4 skeleton placeholders in grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-full">
            <CardContent className="flex flex-col items-center justify-center p-6 h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading latest blogs...
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">
            Failed to load articles. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (displayArticles.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Articles Available</h3>
          <p className="text-muted-foreground">
            No articles available yet. Check back soon for insightful articles!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state - render grid with blog items
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {displayArticles.map((article) => (
        <ContentCard
          key={article.id}
          item={article}
          type="article"
          onClick={() => router.push(articleUrl(article))}
        />
      ))}
    </div>
  );
}
