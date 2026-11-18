"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { getStaticPageBySlug } from "@/lib/static-pages-api";
import AboutSkeleton from "./skeleton";
import AboutPageContent from "./AboutPageContent";
import {
  normalizeAboutUsData,
  type NormalizedAboutUsData,
} from "./about-content";

const CLIENT_MAX_ATTEMPTS = 3;
const CLIENT_RETRY_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AboutPageClient({
  initialData = null,
}: {
  initialData?: NormalizedAboutUsData | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<NormalizedAboutUsData | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFromClient = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    for (let attempt = 1; attempt <= CLIENT_MAX_ATTEMPTS; attempt++) {
      try {
        const page = await getStaticPageBySlug("about-us");
        const normalized = normalizeAboutUsData(page);
        if (normalized) {
          setData(normalized);
          setIsLoading(false);
          return;
        }
        break;
      } catch (err: any) {
        const msg = String(err?.message || "");
        const isNotFound = /not found/i.test(msg);
        if (isNotFound) {
          break;
        }
        if (attempt < CLIENT_MAX_ATTEMPTS) {
          await wait(CLIENT_RETRY_DELAY_MS * attempt);
          continue;
        }
      }
    }

    setIsLoading(false);
    setErrorMessage(
      "Unable to load the About Us page right now. Please try again.",
    );
  }, []);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      for (let attempt = 1; attempt <= CLIENT_MAX_ATTEMPTS; attempt++) {
        try {
          const page = await getStaticPageBySlug("about-us");
          if (cancelled) return;
          const normalized = normalizeAboutUsData(page);
          if (normalized) {
            setData(normalized);
            setIsLoading(false);
            return;
          }
          break;
        } catch (err: any) {
          if (cancelled) return;
          const msg = String(err?.message || "");
          if (/not found/i.test(msg)) {
            break;
          }
          if (attempt < CLIENT_MAX_ATTEMPTS) {
            await wait(CLIENT_RETRY_DELAY_MS * attempt);
            continue;
          }
        }
      }

      if (!cancelled) {
        setIsLoading(false);
        setErrorMessage(
          "Unable to load the About Us page right now. Please try again.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  if (data) {
    return <AboutPageContent data={data} />;
  }

  if (isLoading) {
    return <AboutSkeleton />;
  }

  return (
    <div className="min-h-[60vh] bg-white flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <h1 className="font-dm-sans text-2xl font-semibold text-slate-900 mb-2">
          About Us
        </h1>
        <p className="font-dm-sans text-sm text-slate-600 leading-relaxed mb-6">
          {errorMessage ||
            "Unable to load the About Us page right now. Please try again."}
        </p>
        <button
          type="button"
          onClick={() => {
            void loadFromClient();
            router.refresh();
          }}
          className="font-dm-sans inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
