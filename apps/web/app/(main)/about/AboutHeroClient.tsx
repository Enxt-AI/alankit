"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Search,
  Tag,
  Headphones,
  Wallet,
  ArrowRight,
  TrendingUp
} from "lucide-react";

interface Feature {
  icon?: string;
  title: string;
  desc: string;
}

interface AboutHeroClientProps {
  badge?: string;
  title: string;
  subtitle: string;
  features: Feature[];
  imageUrl: string;
}

const IconResolver = ({ name }: { name?: string }) => {
  switch (name) {
    case "Search": return <Search className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />;
    case "Tag": return <Tag className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />;
    case "ShieldCheck": return <ShieldCheck className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />;
    case "Headphones": return <Headphones className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />;
    default: return <ShieldCheck className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />;
  }
};

export default function AboutHeroClient({
  title,
  subtitle,
  features,
  imageUrl,
}: AboutHeroClientProps) {
  // Take top 3 features to fit the hero column cleanly
  const displayFeatures = features.slice(0, 3);

  // Clean title: avoid orphaned prepositions like "for" on its own line and style highlighted spans
  const formattedTitle = (title || "")
    .replace(/\s*for\s*<br\s*\/?>\s*/gi, " for ")
    .replace(/<br\s*\/?>\s*for\s*/gi, " for ")
    .replace(/text-emerald-600/gi, "text-green-600")
    .replace(/<span([^>]*)>/gi, '<span$1 class="text-green-600">');

  return (
    <section className="relative overflow-hidden bg-white pt-14 pb-8 lg:pt-20 lg:pb-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left Column: Content */}
          <div className="flex flex-col relative z-20">

            {/* Main Heading — DM Sans 56px, Semi-bold, tight tracking */}
            <h1
              className="font-dm-sans text-4xl sm:text-5xl lg:text-[56px] font-semibold text-[#0F172A] leading-[1.14] tracking-[-0.028em] mb-5 text-balance [&_span]:!text-green-600 [&_span]:font-semibold"
              dangerouslySetInnerHTML={{ __html: formattedTitle }}
            />

            {/* Subtitle — DM Sans, refined size */}
            <p className="font-dm-sans text-sm sm:text-base text-slate-600 mb-7 max-w-lg leading-relaxed font-normal tracking-[-0.01em]">
              {subtitle}
            </p>

            {/* Feature Cards */}
            <div className="flex flex-col space-y-3.5 max-w-[490px] mb-9">
              {displayFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-emerald-200 hover:shadow-[0_8px_24px_rgba(16,185,129,0.06)] transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/70 transition-colors">
                    <IconResolver name={feature.icon} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-dm-sans font-semibold text-[16px] text-slate-900 tracking-tight mb-0.5">
                      {feature.title}
                    </h3>
                    <p className="font-dm-sans text-slate-500 text-[13.5px] leading-snug">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/stocks"
                className="font-dm-sans inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[15px] rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.99] transition-all duration-200 group"
              >
                <span>Explore Investment Opportunities</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="tel:+919911944094"
                className="font-dm-sans inline-flex items-center px-6 py-3.5 text-slate-700 hover:text-slate-900 font-medium text-[15px] rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all duration-200"
              >
                Talk to an Expert
              </Link>
            </div>
          </div>

          {/* Right Column: Illustration & Floating Cards — desktop only */}
          <div className="relative hidden lg:flex justify-center lg:justify-end mt-12 lg:mt-0 z-10">
            <div className="relative w-full max-w-[540px] z-10 py-6 lg:pl-6">
              <Image
                src={imageUrl}
                alt="UnlistedStox Benefits Illustration"
                width={600}
                height={600}
                className="w-full h-auto object-contain relative drop-shadow-xl"
                priority
              />

              {/* Top Floating Card */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[8%] right-[-2%] sm:right-[2%] lg:right-[-10px] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-[0_16px_36px_rgba(0,0,0,0.06)] hidden lg:flex items-center gap-3.5 border border-slate-100/90 min-w-[210px]"
              >
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/25">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-dm-sans text-slate-900 font-semibold text-[13.5px] leading-tight mb-0.5">Invest In Tomorrow</p>
                  <p className="font-dm-sans text-slate-500 text-[11.5px] leading-tight font-normal">High-growth startups</p>
                </div>
              </motion.div> 

              {/* Bottom Floating Card */}
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[4%] left-[-2%] sm:left-[4%] lg:left-[-20px] z-20 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-[0_16px_36px_rgba(0,0,0,0.06)] hidden lg:flex items-center gap-4 border border-slate-100/90 min-w-[280px]"
              >
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/25">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-dm-sans text-slate-900 font-semibold text-[13.5px] leading-tight mb-0.5">Pre-IPO Access</span>
                  <span className="font-dm-sans text-slate-500 text-[11.5px] leading-tight font-normal">For discerning investors</span>
                </div>
              </motion.div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

