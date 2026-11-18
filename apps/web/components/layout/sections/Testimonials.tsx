"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { useTestimonials } from "@/hooks/use-testimonials";
import { useIsStandalone } from "@/hooks/use-is-standalone";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// ---------------------------------------------------------------------------
// Card display shape -- used by both fallback and dynamic testimonials.
// ---------------------------------------------------------------------------
interface TestimonialCard {
  name: string;
  role: string;   // "Designation, Company" (e.g. "CEO, TechStart Inc.")
  image: string;  // Avatar URL (currently always "/profile.png")
  text: string;   // The testimonial quote
}

// ---------------------------------------------------------------------------
// FALLBACK_TESTIMONIALS
// ---------------------------------------------------------------------------
const FALLBACK_TESTIMONIALS: TestimonialCard[] = [
  {
    name: "Vikram Malhotra",
    role: "Angel Investor & Managing Director",
    image: "/profile.png",
    text: "SMC UnlistedStox made buying pre-IPO shares completely frictionless. Transparent pricing and swift direct-to-Demat transfers give immense peace of mind.",
  },
  {
    name: "Pooja Singhal",
    role: "Chartered Accountant & Portfolio Lead",
    image: "/profile.png",
    text: "The financial insights and research depth on unlisted companies are best-in-class. A truly reliable platform for serious high-net-worth investors.",
  },
  {
    name: "Rajesh Kulkarni",
    role: "VP Engineering & Tech Investor",
    image: "/profile.png",
    text: "Seamless KYC, smooth digital payment execution, and prompt support from relationship managers. Highly recommended for unlisted shares!",
  },
];

export default function Testimonials() {
  const { isMounted, isStandalone } = useIsStandalone();

  // ---------------------------------------------------------------------------
  // Fetch active testimonials from the public API.
  // The hook uses a 10-minute stale-time since testimonials rarely change.
  // ---------------------------------------------------------------------------
  const { data: apiTestimonials } = useTestimonials();

  const displayTestimonials: TestimonialCard[] = useMemo(() => {
    if (apiTestimonials && apiTestimonials.length > 0) {
      return apiTestimonials.map((t) => ({
        name: t.name,
        role: `${t.designation}, ${t.company}`,
        image: "/profile.png",
        text: t.feedback,
      }));
    }
    return FALLBACK_TESTIMONIALS;
  }, [apiTestimonials]);

  // Hide completely in PWA or native Android app
  if (isMounted && isStandalone) {
    return null;
  }

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-14">
          <div className="flex items-center justify-center gap-6 mb-5">
            <div className="h-[1px] w-16 sm:w-24 bg-slate-200" />
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-[#16a34a]">
              Testimonials
            </span>
            <div className="h-[1px] w-16 sm:w-24 bg-slate-200" />
          </div>
          <h2 className="text-[22px] sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 whitespace-nowrap sm:whitespace-normal">
            What Our Clients Say
          </h2>
          <p className="mt-2 sm:mt-4 mx-auto max-w-2xl text-gray-500 text-[11px] sm:text-md whitespace-nowrap sm:whitespace-normal">
            Preferred by growth-oriented investors across India
          </p>
        </div>

        {displayTestimonials.length > 0 ? (
          <>
            {/* Mobile Carousel */}
            <div className="block sm:hidden w-full">
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                plugins={[
                  Autoplay({
                    delay: 4000,
                  }),
                ]}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {displayTestimonials.map((item, index) => (
                    <CarouselItem key={index} className="pl-4 basis-[85%]">
                      <div
                        className="h-full rounded-2xl border border-white/20 bg-white/40 backdrop-blur-md p-6 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className="w-4 h-4 fill-amber-400 text-amber-400"
                            />
                          ))}
                        </div>
                        <p className="text-gray-600 leading-relaxed text-sm flex-1">
                          &ldquo;{item.text}&rdquo;
                        </p>
                        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{item.role}</p>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>

            {/* Desktop Marquee (Infinite Moving Cards) */}
            <div className="hidden sm:flex relative overflow-hidden w-full [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] pb-4">
              <div className="flex gap-6 w-max animate-marquee hover:[animation-play-state:paused]">
                {/* 
                  Duplicate the items 3 times to ensure a smooth continuous loop without snapping. 
                  In a real app, if you have 10+ testimonials, you might only need to duplicate them twice. 
                */}
                {[...displayTestimonials, ...displayTestimonials, ...displayTestimonials].map((item, index) => (
                  <div
                    key={index}
                    className="w-[380px] shrink-0 rounded-2xl border border-gray-100 bg-white p-7 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-1 hover:border-green-200 transition-all duration-300"
                  >
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0"
                        />
                      ))}
                    </div>
                    <p className="text-gray-600 leading-relaxed text-sm flex-1">
                      &ldquo;{item.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{item.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50/50 rounded-2xl border border-gray-100 border-dashed text-center max-w-3xl mx-auto">
            <div className="bg-white p-4 rounded-full shadow-sm border border-gray-100 mb-4">
              <Star className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Check back soon!</h3>
            <p className="text-sm text-gray-500 max-w-md">
              We&apos;re currently gathering more feedback from our investors. New testimonials will be featured here shortly.
            </p>
          </div>
        )}

        {/* Trust badge - Desktop Only (Below reviews) */}
        <div className="hidden sm:flex justify-center mt-14">
          <div className="flex items-center gap-3 bg-white border border-gray-200 px-6 py-4 rounded-2xl shadow-sm">
            <Image src="/badge.svg" alt="Trust badge" width={36} height={32} />
            <div className="leading-tight text-left">
              <p className="text-xs text-gray-500">Trusted by over</p>
              <p className="text-xl font-bold text-gray-900">
                500+ Investors
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
