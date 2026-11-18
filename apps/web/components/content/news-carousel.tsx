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
    <>
      {/* Mobile: Vertical List */}
      <div className="md:hidden flex flex-col gap-4">
        {displayNews.slice(0, 3).map((newsItem) => (
          <ContentCard
            key={newsItem.id}
            item={newsItem}
            type="news"
            onClick={() => onNewsClick(newsItem.id)}
          />
        ))}
      </div>

      {/* Desktop: Carousel */}
      <div className="hidden md:block w-full">
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <div className="flex items-center justify-end gap-2 mb-4">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
          <CarouselContent className="-ml-2 md:-ml-4">
            {displayNews.map((newsItem) => (
              <CarouselItem
                key={newsItem.id}
                className="pl-2 md:pl-4 sm:basis-1/2 lg:basis-1/3 h-full"
              >
                <ContentCard
                  item={newsItem}
                  type="news"
                  onClick={() => onNewsClick(newsItem.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </>
  );
}
