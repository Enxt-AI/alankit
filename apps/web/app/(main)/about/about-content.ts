import DOMPurify from "isomorphic-dompurify";
import type { StaticPage } from "@/types/content";

export interface AboutFeatureItem {
  icon?: string;
  title: string;
  desc: string;
}

export interface AboutLeadershipMember {
  photoUrl?: string;
  cleanName: string;
  cleanRole: string;
  cleanDesc: string;
  initials: string;
}

export interface NormalizedAboutUsData {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  ourStoryBadge: string;
  ourStoryHtml: string;
  whyChooseUsTitle: string;
  whyChooseUsFeatures: AboutFeatureItem[];
  leadershipTitle: string;
  leadershipDesc: string;
  leadershipMembers: AboutLeadershipMember[];
}

export function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export function isJsonLike(str: string): boolean {
  const t = str.trim();
  return t.startsWith("{") && t.endsWith("}");
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["span"],
    ADD_ATTR: ["class", "style"],
  });
}

export function cleanCorruptedJson(str: string): string {
  return str
    .replace(/class=\\"\\&quot;([^"]*?)\\"/g, "class='$1'")
    .replace(/class=\\"\\&quot;([^"]*?)>/g, "class='$1'>")
    .replace(/class="\\&quot;([^"]*?)>/g, "class='$1'>")
    .replace(/class="\\&quot;([^"]*?)"/g, "class='$1'")
    .replace(/\\&quot;/g, "'")
    .replace(/&quot;/g, '"');
}

export function parseAboutUsContent(rawContent: string): Record<string, any> | null {
  if (!rawContent) return null;
  const trimmed = rawContent.trim();

  try {
    if (isJsonLike(trimmed)) {
      return JSON.parse(trimmed);
    }
  } catch {
    // fall through to decoded extraction
  }

  try {
    const decoded = decodeHtml(trimmed);
    if (isJsonLike(decoded)) {
      return JSON.parse(decoded);
    }
    const firstCurly = decoded.indexOf("{");
    const lastCurly = decoded.lastIndexOf("}");
    if (firstCurly !== -1 && lastCurly !== -1 && firstCurly < lastCurly) {
      const candidate = decoded.substring(firstCurly, lastCurly + 1);
      if (isJsonLike(candidate)) {
        return JSON.parse(candidate);
      }
    }
  } catch {
    // fall through to repair
  }

  try {
    const cleaned = cleanCorruptedJson(trimmed);
    if (isJsonLike(cleaned)) {
      return JSON.parse(cleaned);
    }
  } catch (err) {
    console.error("[AboutPage] CMS content JSON parse error:", err);
  }

  if (isJsonLike(trimmed)) {
    console.error("[AboutPage] Content looks like JSON but failed to parse; falling back to defaults");
    return null;
  }

  return null;
}

export function normalizeAboutUsData(
  page: Pick<StaticPage, "content" | "isActive"> | null | undefined,
): NormalizedAboutUsData | null {
  if (!page || page.isActive === false || !page.content) {
    return null;
  }

  const cmsData = parseAboutUsContent(page.content);
  if (!cmsData) {
    if (isJsonLike(page.content)) {
      console.warn("[AboutPage] CMS JSON detected but parse returned null");
    }
    return null;
  }

  let heroTitle = cmsData?.hero_title ?? cmsData?.hero?.title ?? "";
  if (typeof heroTitle === "string" && heroTitle) {
    heroTitle = heroTitle
      .replace(/\s*for\s*<br\s*\/?>\s*/gi, " for ")
      .replace(/<br\s*\/?>\s*for\s*/gi, " for ")
      .replace(/bg-gradient-to-[a-z0-9-]+/gi, "")
      .replace(/bg-clip-text/gi, "")
      .replace(/text-transparent/gi, "")
      .replace(/from-[a-z0-9-]+/gi, "")
      .replace(/to-[a-z0-9-]+/gi, "");

    heroTitle = heroTitle.replace(/text-emerald-600/gi, "text-green-600");
    if (!heroTitle.includes("text-green-600")) {
      heroTitle = heroTitle.replace(/<span([^>]*)>/gi, '<span$1 class="text-green-600">');
    }
  }

  const sanitizedHeroTitle = sanitizeHtml(
    typeof heroTitle === "string" ? heroTitle : String(heroTitle || ""),
  );
  const heroSubtitle = cmsData?.hero_subtitle ?? cmsData?.hero?.subtitle ?? "";
  const heroImageUrl =
    cmsData?.hero_imageUrl ?? cmsData?.hero?.imageUrl ?? "/images/about/hero.png";

  const ourStoryBadge = cmsData?.ourStory_badge ?? cmsData?.ourStory?.badge ?? "";
  const rawOurStory = cmsData.ourStory_html ?? cmsData.ourStory?.content ?? "";
  const ourStoryHtml = sanitizeHtml(
    String(rawOurStory || "")
      .replace(/<h1/gi, "<h2")
      .replace(/<\/h1>/gi, "</h2>"),
  );

  const whyChooseUsTitle = cmsData?.whyChooseUs_title ?? cmsData?.whyChooseUs?.title ?? "";
  const rawFeatures = Array.isArray(cmsData?.whyChooseUs_features)
    ? cmsData.whyChooseUs_features
    : Array.isArray(cmsData?.whyChooseUs?.features)
      ? cmsData.whyChooseUs.features
      : [];
  const whyChooseUsFeatures: AboutFeatureItem[] = rawFeatures.map((feature: any) => ({
    icon: feature?.icon,
    title: String(feature?.title ?? ""),
    desc: String(feature?.desc ?? ""),
  }));

  const leadershipTitle = cmsData?.leadership_title ?? cmsData?.leadership?.title ?? "";
  const leadershipDesc = cmsData?.leadership_desc ?? cmsData?.leadership?.desc ?? "";
  const rawMembers = Array.isArray(cmsData?.leadership_members)
    ? cmsData.leadership_members
    : Array.isArray(cmsData?.leadership?.members)
      ? cmsData.leadership.members
      : [];

  const leadershipMembers: AboutLeadershipMember[] = rawMembers.map((leader: any) => {
    const photoUrl =
      leader?.imageUrl || leader?.photoUrl || leader?.image || leader?.photo || undefined;
    const cleanName = decodeHtml(String(leader?.name || ""));
    const cleanRole = decodeHtml(String(leader?.role || "")).replace(/&amp;/gi, "&");
    const cleanDesc = decodeHtml(String(leader?.desc || leader?.description || ""));
    const initials =
      leader?.initials ||
      (cleanName
        ? cleanName
            .split(" ")
            .filter(Boolean)
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "");

    return {
      photoUrl,
      cleanName,
      cleanRole,
      cleanDesc,
      initials,
    };
  });

  return {
    heroTitle: sanitizedHeroTitle,
    heroSubtitle,
    heroImageUrl: heroImageUrl || "/images/about/hero.png",
    ourStoryBadge,
    ourStoryHtml,
    whyChooseUsTitle,
    whyChooseUsFeatures,
    leadershipTitle,
    leadershipDesc,
    leadershipMembers,
  };
}
