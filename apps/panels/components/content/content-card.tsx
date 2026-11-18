"use client";

/**
 * ContentCard Component
 *
 * Reusable card for displaying news and article items
 * Used in carousel, news listing, and article listing
 */

import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Eye, Heart } from "lucide-react";
import type { News, Article } from "@/types/content";
import { cn, getStorageUrl } from "@/lib/utils";

interface ContentCardProps {
  item: News | Article;
  type: "news" | "article";
  onClick: () => void;
}

export function ContentCard({ item, type, onClick }: ContentCardProps) {
  // Format date as readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Extract excerpt from content (first 150 characters)
  const getExcerpt = (content: string) => {
    const plainText = content.replace(/<[^>]*>/g, ""); // Remove HTML tags
    return plainText.length > 150
      ? plainText.substring(0, 150) + "..."
      : plainText;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  if (type === "article") {
    return (
      <article
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${type}: ${item.title}`}
        className="w-full cursor-pointer focus-visible:outline-none"
      >
        <Card
          className={cn(
            " overflow-hidden rounded-md border border-black/10 bg-white shadow-sm",
          )}
        >
          <div className="w-full bg-[#dff3f6]">
            {item.imageUrl ? (
              <img
                src={getStorageUrl(item.imageUrl)}
                alt={item.title}
                width={100}
                height={300}
                className="h-[300px] w-auto object-fill"
              />
            ) : (
              <div className="flex h-[800px] w-full items-center justify-center">
                <Newspaper className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          <CardContent className="flex flex-col p-2">
            <h3 className="text-sm text-black/60">{item.title}</h3>

            <p className="text-md font-medium line-clamp-2">
              {getExcerpt(item.content)}
            </p>
          </CardContent>
        </Card>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${type}: ${item.title}`}
      className={cn(
        "w-full cursor-pointer transition-all duration-200",
        "hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-primary focus-visible:ring-offset-2",
      )}
    >
      <Card className="w-full hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-5">
            {/* LEFT: Image */}
            <div className="relative  md:w-[380px] shrink-0 overflow-hidden rounded-md bg-muted">
              <div className="aspect-[16/9] w-full">
                {item.imageUrl ? (
                  <img
                    src={getStorageUrl(item.imageUrl)}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <Newspaper className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* MIDDLE: Content */}
            <div className="flex flex-1 flex-col gap-2">
              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)}
              </p>

              {/* Title */}
              <h3 className="text-lg font-semibold leading-snug line-clamp-2">
                {item.title}
              </h3>

              {/* Excerpt */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {getExcerpt(item.content)}
              </p>

              {/* Views + Likes */}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                  <Eye className="h-3 w-3" />
                  {/* <span>{item.views ?? 0}</span> */}
                </div>

                <div className="flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                  <Heart className="h-3 w-3" />
                  {/* <span>{item.likes ?? 0}</span> */}
                </div>
              </div>
            </div>

            {/* RIGHT: Read More */}
            <div className="shrink-0">
              <div className="text-sm font-semibold text-black">Read More</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
