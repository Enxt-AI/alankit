"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { useLikedContent } from "@/hooks/use-liked-content";
import { Button } from "@/components/ui/button";
import type { ContentItem } from "@/types/content";

interface ContentLikeButtonProps {
  item: ContentItem;
  contentType: "news" | "article";
  liked?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Client-only island: like toggle for a content item (news or article).
 * Needs useLikedContent (React Query + localStorage), so it cannot be
 * server-rendered.
 */
export function ContentLikeButton({
  item,
  contentType,
  liked: likedProp,
  className,
  size = "sm",
}: ContentLikeButtonProps) {
  const { isLiked, toggleLike } = useLikedContent();
  const liked = likedProp ?? isLiked(item.id);

  const isSm = size === "sm";

  return (
    <Button
      variant="ghost"
      size={isSm ? "sm" : undefined}
      onClick={(e) => toggleLike(item, contentType, e)}
      className={cn(
        "gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1.5 backdrop-blur-md transition-colors text-xs sm:text-sm",
        liked
          ? size === "sm"
            ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
            : "bg-rose-50 text-rose-600 border border-rose-200"
          : "text-white/90 hover:text-white hover:bg-white/10",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          liked
            ? size === "sm"
              ? "fill-rose-400 text-rose-400"
              : "fill-rose-500 text-rose-500"
            : "",
        )}
      />
      <span className="text-xs sm:text-sm font-medium">
        {liked ? "Liked" : "Like"}
      </span>
    </Button>
  );
}
