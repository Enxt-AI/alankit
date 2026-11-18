'use client';

import { useEffect, useMemo, useState } from 'react';
import { getStaticPageBySlug } from '@/lib/static-pages-api';
import type { StaticPage } from '@/types/content';

type PublicStaticPageProps = {
  defaultTitle: string;
  slugsToTry: string[];
  defaultHtml?: string;
};

export function PublicStaticPage({
  defaultTitle,
  slugsToTry,
  defaultHtml,
}: PublicStaticPageProps) {
  const [page, setPage] = useState<StaticPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedSlugs = useMemo(() => {
    const unique = Array.from(
      new Set(slugsToTry.map((s) => String(s || '').trim()).filter(Boolean))
    );
    return unique;
  }, [slugsToTry]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      setPage(null);

      for (const slug of normalizedSlugs) {
        try {
          const result = await getStaticPageBySlug(slug);
          if (cancelled) return;

          if (result?.isActive === false) {
            continue;
          }

          setPage(result);
          setIsLoading(false);
          return;
        } catch (err: any) {
          if (cancelled) return;

          const message = String(err?.message || '');
          const notFound = /not found/i.test(message);
          if (notFound) {
            continue;
          }

          setErrorMessage(message || 'Failed to load this page.');
          setIsLoading(false);
          return;
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [normalizedSlugs]);

  const title = page?.title || defaultTitle;
  const html = page?.content || defaultHtml || '';

  return (
    <main className='text-center'>
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
        {title}
      </h1>

      {isLoading ? (
        <p className="mt-6 text-gray-600">Loading…</p>
      ) : errorMessage ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : html ? (
        <article
          className="prose prose-slate mt-4 max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="mt-6 text-gray-600">This page is not available yet.</p>
      )}
    </main>
  );
}
