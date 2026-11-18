import React from "react";
import type { Metadata } from "next";
import { fetchStaticPageBySlug } from "@/lib/static-pages-server";
import { constructMetadata } from "@/lib/seo-helper";
import AboutPageContent from "./AboutPageContent";
import AboutPageClient from "./AboutPageClient";
import AboutScrollReset from "./AboutScrollReset";
import { normalizeAboutUsData } from "./about-content";

// Render dynamically on request so `next build` does not bake a fallback
// skeleton into the Full Route Cache when the backend is unreachable at build time.
// Successful CMS responses remain cached for 60s via the Data Cache tag
// `static-page-about-us` inside `fetchStaticPageBySlug`.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchStaticPageBySlug("about-us");

  if (!page) {
    return constructMetadata("/about", {
      title: "About Us",
      description:
        "Learn more about UnlistedStox and our mission to provide secure access to pre-IPO and unlisted shares.",
    });
  }

  const rawTitle = page.metaTitle ?? page.title;
  const cleanTitle = rawTitle.replace(/\s*\|\s*UnlistedStox\s*$/i, "");

  return constructMetadata("/about", {
    title: cleanTitle,
    description:
      page.metaDescription ??
      "Learn more about UnlistedStox and our mission to provide secure access to pre-IPO and unlisted shares.",
  });
}

export default async function AboutPage() {
  const page = await fetchStaticPageBySlug("about-us");
  const data = normalizeAboutUsData(page);

  return (
    <>
      <AboutScrollReset />
      {data ? <AboutPageContent data={data} /> : <AboutPageClient />}
    </>
  );
}
