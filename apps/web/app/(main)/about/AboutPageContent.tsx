import React from "react";
import AboutHeroClient from "./AboutHeroClient";
import type { NormalizedAboutUsData } from "./about-content";
import { getStorageUrl } from "@/lib/utils";
import {
  ArrowRight,
  PhoneCall,
  Users,
  TrendingUp,
  ShieldCheck,
  Search,
  Tag,
  Headphones,
  Compass,
  FileText,
  UserCheck,
  Wallet,
  LineChart,
  Award,
  Building,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

const iconMap: Record<string, any> = {
  ArrowRight,
  PhoneCall,
  Users,
  TrendingUp,
  ShieldCheck,
  Search,
  Tag,
  Headphones,
  Compass,
  FileText,
  UserCheck,
  Wallet,
  LineChart,
  Award,
  Building,
  BookOpen,
  ArrowUpRight,
};

function resolveIcon(name?: string) {
  if (!name) return Award;
  const normalized = name.trim().toLowerCase();

  if (
    normalized.includes("active") ||
    normalized.includes("investor") ||
    normalized.includes("user")
  ) {
    return Users;
  }
  if (
    normalized.includes("turnover") ||
    normalized.includes("revenue") ||
    normalized.includes("growth") ||
    normalized.includes("trend")
  ) {
    return TrendingUp;
  }
  if (
    normalized.includes("share") ||
    normalized.includes("trade") ||
    normalized.includes("volume") ||
    normalized.includes("chart")
  ) {
    return LineChart;
  }
  if (
    normalized.includes("legacy") ||
    normalized.includes("year") ||
    normalized.includes("history") ||
    normalized.includes("award")
  ) {
    return Award;
  }
  if (normalized.includes("search") || normalized.includes("research")) {
    return Search;
  }
  if (
    normalized.includes("tag") ||
    normalized.includes("price") ||
    normalized.includes("pricing")
  ) {
    return Tag;
  }
  if (
    normalized.includes("shield") ||
    normalized.includes("secure") ||
    normalized.includes("safety")
  ) {
    return ShieldCheck;
  }
  if (
    normalized.includes("phone") ||
    normalized.includes("call") ||
    normalized.includes("support")
  ) {
    return Headphones;
  }
  if (normalized.includes("compass") || normalized.includes("discover")) {
    return Compass;
  }
  if (normalized.includes("file") || normalized.includes("document")) {
    return FileText;
  }
  if (normalized.includes("check") || normalized.includes("kyc")) {
    return UserCheck;
  }
  if (normalized.includes("wallet") || normalized.includes("payment")) {
    return Wallet;
  }
  if (
    normalized.includes("building") ||
    normalized.includes("company") ||
    normalized.includes("brand")
  ) {
    return Building;
  }
  if (normalized.includes("book") || normalized.includes("education")) {
    return BookOpen;
  }

  for (const [key, value] of Object.entries(iconMap)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }

  return Award;
}

export default function AboutPageContent({
  data,
}: {
  data: NormalizedAboutUsData;
}) {
  const {
    heroTitle,
    heroSubtitle,
    heroImageUrl,
    ourStoryBadge,
    ourStoryHtml,
    whyChooseUsTitle,
    whyChooseUsFeatures,
    leadershipTitle,
    leadershipDesc,
    leadershipMembers,
  } = data;

  return (
    <div className="min-h-screen bg-white">
      {/* ── 1. HERO SECTION ── */}
      <AboutHeroClient
        title={heroTitle}
        subtitle={heroSubtitle}
        features={whyChooseUsFeatures}
        imageUrl={heroImageUrl || "/images/about/hero.png"}
      />

      {/* ── 3. OUR STORY SECTION ── */}
      <section className="pt-0 pb-20 sm:py-20 bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 flex flex-col items-start w-full">
              <h2 className="font-dm-sans text-3xl md:text-4xl font-semibold text-slate-900 tracking-[-0.025em] mt-4 mb-6">
                {ourStoryBadge}
              </h2>

              <div
                className="prose prose-emerald max-w-none prose-slate w-full
                  prose-headings:font-dm-sans prose-headings:font-semibold prose-headings:text-slate-900 prose-headings:tracking-[-0.025em]
                  prose-h2:font-dm-sans prose-h2:text-3xl prose-h2:md:text-4xl prose-h2:font-semibold prose-h2:text-slate-900 prose-h2:tracking-[-0.025em] prose-h2:mb-6
                  prose-p:font-dm-sans prose-p:text-slate-600 prose-p:text-base prose-p:md:text-[17px] prose-p:leading-relaxed prose-p:mb-6
                  prose-strong:text-slate-900 prose-strong:font-semibold
                  prose-blockquote:border-l-4 prose-blockquote:border-emerald-500 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-slate-700 prose-blockquote:bg-emerald-50/10 prose-blockquote:py-5 prose-blockquote:pr-6 prose-blockquote:rounded-r-2xl prose-blockquote:my-8"
                dangerouslySetInnerHTML={{
                  __html: ourStoryHtml,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. WHY CHOOSE US SECTION ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-dm-sans text-3xl md:text-4xl font-semibold text-slate-900 tracking-[-0.025em] mt-4">
              {whyChooseUsTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyChooseUsFeatures.map((feature, idx) => {
              const IconComponent = resolveIcon(feature.icon);
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300"
                >
                  <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                    <IconComponent className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 8. OUR LEADERSHIP SECTION ── */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-dm-sans text-3xl md:text-4xl font-semibold text-slate-900 tracking-[-0.025em]">
              {leadershipTitle}
            </h2>
            <p className="font-dm-sans text-slate-500 text-sm sm:text-base leading-relaxed mt-4">
              {leadershipDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {leadershipMembers.map((leader, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
              >
                {leader.photoUrl ? (
                  <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-sm mb-5 relative border border-slate-100 flex-shrink-0 bg-slate-50">
                    <img
                      src={getStorageUrl(leader.photoUrl)}
                      alt={leader.cleanName}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm mb-5 flex-shrink-0">
                    {leader.initials}
                  </div>
                )}
                <h3 className="font-dm-sans text-lg font-semibold text-slate-900 mb-1">
                  {leader.cleanName}
                </h3>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-4 leading-normal min-h-[32px]">
                  {leader.cleanRole}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed flex-grow">
                  {leader.cleanDesc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
