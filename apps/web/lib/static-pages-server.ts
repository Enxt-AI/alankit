/**
 * Server-side helpers for fetching static pages inside React Server Components.
 *
 * Uses the native `fetch()` API (NOT Axios) so Next.js can cache and
 * revalidate responses through its built-in data cache.
 */

import { cache } from 'react';
import type { StaticPage } from '@/types/content';

const FETCH_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 250;

function normalizeApiBaseUrl(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.startsWith('/')) {
    return null;
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/**
 * Resolve ordered candidate stocks-service base URLs (server-side only).
 *
 * Prioritises explicit service/gateway env vars, then falls back to direct
 * service origins so build/local environments do not fail permanently when
 * `BACKEND_ORIGIN` points to a Docker-only hostname (e.g. `http://nginx:90`).
 */
export function getBackendUrls(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const candidates: string[] = [];
  const pushUnique = (url: string | null) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  pushUnique(normalizeApiBaseUrl(env.STOCKS_SERVICE_URL));
  pushUnique(normalizeApiBaseUrl(env.BACKEND_ORIGIN));
  pushUnique(normalizeApiBaseUrl(env.NEXT_PUBLIC_STOCKS_SERVICE_URL));

  const isDockerProd = env.NODE_ENV === 'production';
  if (isDockerProd) {
    pushUnique('http://stocks-service:3003/api');
  }

  pushUnique('http://127.0.0.1:3003/api');
  pushUnique('http://localhost:3003/api');

  return candidates;
}

/** Resolve the primary stocks-service base URL (server-side only). */
export function getBackendUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return getBackendUrls(env)[0] ?? 'http://127.0.0.1:3003/api';
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchStaticPageOptions {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  retryDelayMs?: number;
}

const inFlightBySlug = new Map<string, Promise<StaticPage | null>>();

export async function fetchStaticPageBySlugUncached(
  slug: string,
  options: FetchStaticPageOptions = {},
): Promise<StaticPage | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrls = getBackendUrls(options.env ?? process.env);
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;

  let lastError: unknown = null;

  for (let urlIndex = 0; urlIndex < baseUrls.length; urlIndex++) {
    const baseUrl = baseUrls[urlIndex];
    const url = `${baseUrl}/static-pages/slug/${encodeURIComponent(slug)}`;
    // Retry transient failures once on the primary origin before trying fallbacks
    const maxAttempts = urlIndex === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchImpl(url, {
          next: { tags: [`static-page-${slug}`], revalidate: 60 },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
          if (res.status === 404) {
            return null;
          }

          lastError = new Error(
            `[static-pages-server] ${res.status} fetching slug "${slug}" from ${baseUrl}`,
          );

          if (isRetryableStatus(res.status) && attempt < maxAttempts) {
            await delay(retryDelayMs);
            continue;
          }
          break;
        }

        const data = (await res.json()) as StaticPage | null;
        if (!data || data.isActive === false) {
          return null;
        }
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await delay(retryDelayMs);
          continue;
        }
      }
    }
  }

  if (lastError) {
    console.error(`[static-pages-server] Error fetching slug "${slug}":`, lastError);
  }
  return null;
}

const fetchStaticPageMemoized = cache((slug: string): Promise<StaticPage | null> => {
  const existing = inFlightBySlug.get(slug);
  if (existing) {
    return existing;
  }

  const request = fetchStaticPageBySlugUncached(slug).finally(() => {
    inFlightBySlug.delete(slug);
  });

  inFlightBySlug.set(slug, request);
  return request;
});

/**
 * Fetch a **public** static page by slug from the stocks-service.
 *
 * The response is cached by Next.js and tagged with `static-page-{slug}`
 * so it can be purged on-demand via the `/api/revalidate` route handler.
 *
 * Returns `null` when the page does not exist or the backend is unreachable,
 * allowing the caller to render a graceful fallback.
 */
export async function fetchStaticPageBySlug(
  slug: string,
): Promise<StaticPage | null> {
  return fetchStaticPageMemoized(slug);
}
