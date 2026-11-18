"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Linkedin } from "lucide-react";
import type { Article } from "@/types/content";

interface ArticleShareBarProps {
  article: Article;
  className?: string;
}

/**
 * Client-only island: share buttons for an article.
 * Needs navigator.share / clipboard / window.open, so it cannot be
 * server-rendered.
 */
export function ArticleShareBar({
  article,
  className,
}: ArticleShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const title = article.title || "UnlistedStox Article";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareSocial = (platform: "facebook" | "twitter" | "linkedin") => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title || "UnlistedStox Article");

    let shareUrl = "";
    if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=450,noopener,noreferrer");
    }
  };

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="gap-1 sm:gap-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded-full px-2.5 sm:px-3.5 py-1.5 backdrop-blur-md transition-colors text-xs sm:text-sm"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-semibold text-emerald-400">
              Copied!
            </span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">Share</span>
          </>
        )}
      </Button>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">
          Share
        </span>
        <button
          onClick={() => shareSocial("facebook")}
          title="Share on Facebook"
          className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
        >
          <Facebook className="h-4 w-4" />
        </button>
        <button
          onClick={() => shareSocial("twitter")}
          title="Share on Twitter"
          className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
        >
          <Twitter className="h-4 w-4" />
        </button>
        <button
          onClick={() => shareSocial("linkedin")}
          title="Share on LinkedIn"
          className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
        >
          <Linkedin className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
