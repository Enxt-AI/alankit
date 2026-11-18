"use client";

/**
 * NewsCarousel Component
 * 
 * Carousel displaying news articles on dashboard
 * Uses Shadcn Carousel component with responsive breakpoints
 */

import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ContentCard } from "@/components/content/content-card";
import type { News } from "@/types/content";

interface NewsCarouselProps {
  news: News[];
  onNewsClick: (newsId: string) => void;
}

export function NewsCarousel({ news, onNewsClick }: NewsCarouselProps) {
  // Limit to first 6 items for performance
  const displayNews = news.slice(0, 6);

  if (displayNews.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No news available</p>
      </Card>
    );
  }

  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full"
    >
      <CarouselContent>
        {displayNews.map((newsItem) => (
          <CarouselItem
            key={newsItem.id}
            className="md:basis-1/1 lg:basis-1/2"
          >
            <ContentCard
              item={newsItem}
              type="news"
              onClick={() => onNewsClick(newsItem.id)}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden" />
      <CarouselNext className="hidden" />
    </Carousel>
  );
}
