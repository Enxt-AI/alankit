"use client";

/**
 * Blog Listing Page
 *
 * Displays all active blog posts in a grid layout
 * Click on a blog card to navigate to the detail page
 */

import { useRouter } from "next/navigation";
import { useArticles } from "@/hooks/use-content";
import { ContentList } from "@/components/content/content-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function ArticlesPage() {
  const router = useRouter();
  const { data: articles, isLoading, isError, error } = useArticles();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Latest Articles</h1>
          <p className="text-muted-foreground">
            Insights and analysis from our experts
          </p>
        </div>
      </div>
      <ContentList
        items={articles}
        type="article"
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyIcon={
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        }
        emptyTitle="No Articles Available"
        emptyDescription="Check back soon for our latest insights and analysis."
        baseRoute="/dashboard/articles"
      />
    </div>
  );
}
