"use client";

/**
 * ContentList Component
 *
 * Reusable content listing with loading, error, and empty states
 */

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ContentCard } from "@/components/content/content-card";
import { ContentSkeleton } from "@/components/content/content-skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { News, Article } from "@/types/content";

interface ContentListProps {
  items?: News[] | Article[];
  type: "news" | "article";
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyStateOverride?: ReactNode;
  baseRoute: string;
}

import { newsUrl, articleUrl } from "@/lib/slugify";

export function ContentList({
  items,
  type,
  isLoading,
  isError,
  error,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyStateOverride,
  baseRoute,
}: ContentListProps) {
  const router = useRouter();

  // Loading State
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ContentSkeleton count={6} />
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="flex justify-center py-12">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            Failed to Load {type === "news" ? "News" : "Articles"}
          </AlertTitle>
          <AlertDescription>
            {error?.message ||
              `Unable to load ${type}. Please try again later.`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty State
  if (!items || items.length === 0) {
    if (emptyStateOverride) {
      return <>{emptyStateOverride}</>;
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {emptyIcon}
        <h3 className="text-lg font-semibold mb-2">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 ${
        type === "article"
          ? "md:grid-cols-2 lg:grid-cols-3 gap-6"
          : "md:grid-cols-2 gap-6"
      }`}
    >
      {items.map((item) => (
        <ContentCard
          key={item.id}
          item={item}
          type={type}
          onClick={() =>
            router.push(
              type === "news"
                ? newsUrl(item.title)
                : articleUrl(item)
            )
          }
        />
      ))}
    </div>
  );
}
