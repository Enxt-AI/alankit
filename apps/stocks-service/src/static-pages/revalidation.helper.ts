/**
 * Utility to trigger on-demand revalidation on the Next.js frontend
 * after a static page is created, updated, deleted, or rolled back.
 *
 * Fire-and-forget: errors are logged but never thrown so they cannot
 * break the primary CMS mutation flow.
 */

import { PinoNestLogger } from '@smc/logger';

const logger = new PinoNestLogger('stocks-service', 'RevalidationHelper');

/**
 * POST to the frontend's `/api/revalidate` route handler.
 *
 * @param slug        The static-page slug that changed (e.g. "about-us")
 * @param frontendUrl Base URL of the Next.js frontend (no trailing slash)
 * @param secret      Shared secret that the route handler validates
 */
export async function triggerFrontendRevalidation(
  slug: string,
  frontendUrl: string,
  secret: string,
): Promise<void> {
  const trimmedUrl = frontendUrl.replace(/\/+$/, '');
  if (!trimmedUrl || trimmedUrl.includes('localhost')) {
logger.warn(
      `Revalidation for slug "${slug}" may fail: FRONTEND_URL="${frontendUrl}" looks like localhost - check env in production`,
    );
 }
  try {
    const url = `${trimmedUrl}/api/revalidate`;

    // Add timeout to avoid hanging CMS mutation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, secret }),
      signal: controller.signal,
   });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
logger.warn(
        `Revalidation responded ${res.status} for slug "${slug}" via ${url}: ${body}`,
      );
   } else {
      const data = await res.text();
logger.log(`Revalidation triggered for slug "${slug}" via ${url}: ${data}`);
   }
 } catch (error: any) {
    const msg = error?.name === 'AbortError' ? 'timeout after 5s' : String(error);
logger.error(
      `Failed to trigger revalidation for slug "${slug}" to ${frontendUrl}/api/revalidate: ${msg}`,
    );
 }
}
