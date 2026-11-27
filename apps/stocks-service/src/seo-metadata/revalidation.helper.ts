import { PinoNestLogger } from '@repo/logger';

const logger = new PinoNestLogger('stocks-service', 'SeoRevalidationHelper');

/**
 * POST to the frontend's `/api/revalidate` route handler.
 *
 * @param path        The SEO metadata path that changed (e.g. "/")
 * @param frontendUrl Base URL of the Next.js frontend (no trailing slash)
 * @param secret      Shared secret that the route handler validates
 */
export async function triggerFrontendRevalidation(
  path: string,
  frontendUrl: string,
  secret: string,
): Promise<void> {
  try {
    const url = `${frontendUrl}/api/revalidate`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, secret }),
   });

    if (!res.ok) {
      const body = await res.text();
logger.warn(
        `Revalidation responded ${res.status} for path "${path}": ${body}`,
      );
   } else {
logger.log(`Revalidation triggered for path "${path}"`);
   }
 } catch (error) {
logger.error(
      `Failed to trigger revalidation for path "${path}": ${error}`,
    );
 }
}
