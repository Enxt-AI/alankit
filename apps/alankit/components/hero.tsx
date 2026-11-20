"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type HeroBgSlide = {
  id: string;
  image: string;
  alt: string;
};

const heroBgSlides: HeroBgSlide[] = [
  {
    id: "slide-1",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1920&q=85",
    alt: "Stock market trading charts and financial data",
  },
  {
    id: "slide-2",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1920&q=85",
    alt: "Financial district and stock exchange board",
  },
  {
    id: "slide-3",
    image:
      "https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1920&q=85",
    alt: "Candlestick market analysis on screen",
  },
  {
    id: "slide-4",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=85",
    alt: "Modern corporate financial towers",
  },
];

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroBgSlides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide(
      (prev) => (prev - 1 + heroBgSlides.length) % heroBgSlides.length
    );
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 4500);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  return (
    <section
      className="relative w-full overflow-hidden bg-[#0E171B] text-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Full-Bleed Background Image Carousel */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        {heroBgSlides.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-all duration-1000 ease-out ${
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-105"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt={slide.alt}
                className="h-full w-full object-cover object-center"
              />
            </div>
          );
        })}

        {/* Dark Gradient Overlay so text stays legible */}
        <div className="absolute inset-0 bg-linear-to-r from-[#0E171B]/95 via-[#0E171B]/80 to-[#0E171B]/50" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-20 mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-10 lg:py-24">
        <div className="max-w-xl">
          <ScrollReveal variant="fade-up" delayMs={50}>
            <h1 className="text-4xl font-normal tracking-tight text-white sm:text-5xl lg:text-[54px] lg:leading-[1.18]">
              Invest your money
              <br />
              in the Stock market
            </h1>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delayMs={180}>
            <p className="mt-6 text-sm leading-relaxed text-zinc-200 sm:text-base sm:leading-7">
              Get insights from millions of investors, creators, and analysts.
              <br className="hidden sm:inline" /> Sign up now and get your first
              investment on us.
            </p>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delayMs={300}>
            <div className="mt-10 flex items-center">
              <Link href="/stocks">
                <Button className="h-11 rounded-lg bg-[#2563EB] px-6 text-sm font-medium text-white hover:bg-[#1D4ED8] cursor-pointer">
                  Explore Stocks
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom Background Carousel Controls (Dots + Prev/Next) */}
        <ScrollReveal variant="fade-up" delayMs={420}>
          <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-5">
            {/* Pagination Dots */}
            <div className="flex items-center gap-2">
              {heroBgSlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Switch to background slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentSlide
                      ? "w-7 bg-[#2563EB]"
                      : "w-2 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>

            {/* Prev / Next Arrow Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous background image"
                className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next background image"
                className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
