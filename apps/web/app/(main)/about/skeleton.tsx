"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AboutSkeleton() {
  return (
    <div className="min-h-screen bg-white animate-pulse overflow-hidden">
      {/* ── 1. HERO SECTION SKELETON ── */}
      <section className="relative overflow-hidden bg-white pt-14 pb-20 lg:pt-20 lg:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Heading, Subtitle, 3 Feature Cards, CTA */}
            <div className="flex flex-col relative z-20">
              {/* Main Heading H1 skeleton (2 lines) */}
              <div className="space-y-3 mb-5 max-w-xl">
                <Skeleton className="h-10 sm:h-12 lg:h-[52px] w-full rounded-2xl bg-slate-200/80" />
                <Skeleton className="h-10 sm:h-12 lg:h-[52px] w-4/5 rounded-2xl bg-slate-200/80" />
              </div>

              {/* Subtitle skeleton (2 lines) */}
              <div className="space-y-2 mb-7 max-w-lg">
                <Skeleton className="h-4.5 w-full rounded-lg bg-slate-200/70" />
                <Skeleton className="h-4.5 w-3/4 rounded-lg bg-slate-200/70" />
              </div>

              {/* 3 Hero Feature Cards */}
              <div className="flex flex-col space-y-3.5 max-w-[490px] mb-9">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                  >
                    <Skeleton className="w-12 h-12 rounded-xl bg-emerald-100/70 shrink-0" />
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <Skeleton className="h-4 w-36 rounded-md bg-slate-200/80" />
                      <Skeleton className="h-3.5 w-5/6 rounded-md bg-slate-200/60" />
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-12 w-64 rounded-xl bg-emerald-200/70" />
                <Skeleton className="h-12 w-36 rounded-xl bg-slate-200/80" />
              </div>
            </div>

            {/* Right Column: Hero Illustration & Floating Cards — desktop only */}
            <div className="relative hidden lg:flex justify-center lg:justify-end mt-12 lg:mt-0 z-10">
              <div className="relative w-full max-w-[540px] z-10 py-6 lg:pl-6">
                {/* Main Mockup Placeholder */}
                <div className="w-full aspect-[4/3] rounded-3xl bg-slate-100/90 border border-slate-200/70 flex items-center justify-center p-8 shadow-sm">
                  <div className="w-full h-full rounded-2xl bg-slate-200/50 flex flex-col justify-center items-center gap-3">
                    <Skeleton className="w-16 h-16 rounded-2xl bg-slate-300/60" />
                    <Skeleton className="w-48 h-4 rounded-lg bg-slate-300/50" />
                  </div>
                </div>

                {/* Top Floating Badge Skeleton */}
                <div className="absolute top-[8%] right-[-2%] sm:right-[2%] lg:right-[-10px] z-20 bg-white/95 rounded-2xl p-4 shadow-[0_16px_36px_rgba(0,0,0,0.06)] flex items-center gap-3.5 border border-slate-100 min-w-[210px]">
                  <Skeleton className="w-12 h-12 rounded-xl bg-emerald-200/80 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200/90" />
                    <Skeleton className="h-2.5 w-20 rounded-md bg-slate-200/60" />
                  </div>
                </div>

                {/* Bottom Floating Badge Skeleton */}
                <div className="absolute bottom-[10%] left-[-2%] sm:left-[2%] lg:left-[-15px] z-20 bg-white/95 rounded-2xl p-4 shadow-[0_16px_36px_rgba(0,0,0,0.06)] flex items-center gap-3.5 border border-slate-100 min-w-[210px]">
                  <Skeleton className="w-12 h-12 rounded-xl bg-emerald-200/80 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-24 rounded-md bg-slate-200/90" />
                    <Skeleton className="h-2.5 w-28 rounded-md bg-slate-200/60" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. OUR STORY SECTION SKELETON ── */}
      <section className="pt-0 pb-20 sm:py-20 bg-slate-50/50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl flex flex-col items-start w-full">
            {/* Pill Badge */}
            <Skeleton className="h-6 w-24 rounded-full bg-emerald-100/80 mb-6" />

            {/* H2 Title */}
            <Skeleton className="h-9 w-64 rounded-xl bg-slate-200/90 mb-6" />

            {/* Prose Paragraphs */}
            <div className="space-y-3.5 w-full">
              <Skeleton className="h-4.5 w-full rounded-md bg-slate-200/70" />
              <Skeleton className="h-4.5 w-11/12 rounded-md bg-slate-200/70" />
              <Skeleton className="h-4.5 w-4/5 rounded-md bg-slate-200/70" />
            </div>

            <div className="space-y-3.5 w-full mt-6">
              <Skeleton className="h-4.5 w-full rounded-md bg-slate-200/70" />
              <Skeleton className="h-4.5 w-10/12 rounded-md bg-slate-200/70" />
              <Skeleton className="h-4.5 w-3/4 rounded-md bg-slate-200/70" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. WHY CHOOSE US SECTION SKELETON ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 flex flex-col items-center">
            <Skeleton className="h-9 w-80 rounded-xl bg-slate-200/90 mb-3" />
            <Skeleton className="h-4 w-52 rounded-md bg-slate-200/60" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col"
              >
                <Skeleton className="h-12 w-12 rounded-2xl bg-emerald-100/80 mb-6" />
                <Skeleton className="h-5 w-36 rounded-md bg-slate-200/90 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full rounded-md bg-slate-200/60" />
                  <Skeleton className="h-3.5 w-4/5 rounded-md bg-slate-200/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. OUR LEADERSHIP SECTION SKELETON ── */}
      <section className="py-20 bg-slate-50/30 border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col items-center">
            <Skeleton className="h-9 w-48 rounded-xl bg-slate-200/90 mb-4" />
            <Skeleton className="h-4 w-full max-w-xl rounded-md bg-slate-200/60 mb-2" />
            <Skeleton className="h-4 w-4/5 max-w-md rounded-md bg-slate-200/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col h-full"
              >
                {/* Photo box skeleton */}
                <Skeleton className="h-16 w-16 rounded-2xl bg-emerald-100/80 mb-5 shrink-0" />
                {/* Name */}
                <Skeleton className="h-5 w-36 rounded-md bg-slate-200/90 mb-2" />
                {/* Role */}
                <Skeleton className="h-3.5 w-48 rounded-md bg-emerald-100/70 mb-4" />
                {/* Description */}
                <div className="space-y-2 mt-auto">
                  <Skeleton className="h-3 w-full rounded-md bg-slate-200/60" />
                  <Skeleton className="h-3 w-full rounded-md bg-slate-200/60" />
                  <Skeleton className="h-3 w-4/5 rounded-md bg-slate-200/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
