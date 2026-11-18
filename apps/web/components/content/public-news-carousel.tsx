"use client";

/**
 * PublicNewsCarousel Component
 *
 * Public-facing news carousel for landing page
 * Displays 5 latest active news articles with carousel navigation and autoplay
 */

import { useRouter } from "next/navigation";
import { usePublicNews } from "@/hooks/use-content";
import { newsUrl } from "@/lib/slugify";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ContentCard } from "@/components/content/content-card";
import { Loader2, Newspaper, AlertCircle } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import type { News } from "@/types/content";

export function PublicNewsCarousel() {
  const router = useRouter();
  const { data, isLoading, error } = usePublicNews();

  // Limit to 5 latest items
  const displayNews = (data || []).slice(0, 5);

  // Loading state - 3 skeleton placeholders
  if (isLoading) {
    return (
      <Carousel
        opts={{ align: "start", loop: true }}
        plugins={[
          Autoplay({
            delay: 5000,
            stopOnInteraction: true,
            stopOnMouseEnter: true,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent>
          {[1, 2, 3].map((i) => (
            <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center p-6 h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Loading latest news...
                  </p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">
            Failed to load news. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (displayNews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No News Available</h3>
          <p className="text-muted-foreground">
            No news available yet. Check back soon for the latest updates!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state - render carousel with news items
  return (
    <Carousel
      opts={{ align: "start", loop: true }}
      plugins={[
        Autoplay({
          delay: 5000,
          stopOnInteraction: true,
          stopOnMouseEnter: true,
        }),
      ]}
      className="w-full"
    >
      <CarouselContent>
        {displayNews.map((newsItem) => (
          <CarouselItem key={newsItem.id} className="sm:basis-1/2 lg:basis-1/3 h-full">
            <ContentCard
              item={newsItem}
              type="news"
              onClick={() => router.push(newsUrl(newsItem.title))}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:flex" />
      <CarouselNext className="hidden md:flex" />
    </Carousel>
  );
}
