import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Map a CMS slug to the corresponding public route path.
 *
 * About Us lives at /about; all Legal & Policies pages live
 * under /legal-policies/{slug} matching the [id] dynamic segment.
 */
const SLUG_TO_PATH: Record<string, string> = {
  'about-us': '/about',
  'terms-and-conditions': '/legal-policies/terms-and-conditions',
  'privacy-policy': '/legal-policies/privacy-policy',
  'disclaimer': '/legal-policies/disclaimer',
  'cookie-policy': '/legal-policies/cookie-policy',
  'acceptable-use': '/legal-policies/acceptable-use',
  'refund-policy': '/legal-policies/refund-policy',
};

/**
 * POST /api/revalidate
 *
 * On-demand revalidation endpoint called by the stocks-service
 * whenever a static page is created, updated, deleted, or rolled back.
 *
 * Body: { slug: string; secret: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, tag, stockId, path, secret: bodySecret } = body as { 
      slug?: string; 
      tag?: string; 
      stockId?: string; 
      path?: string;
      secret?: string 
    };

    // Validate the shared secret (from Header or Body)
    const expectedSecret = process.env.REVALIDATION_SECRET;
    const authHeader = request.headers.get('authorization');
    const headerSecret = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    const secret = bodySecret || headerSecret;

    if (!expectedSecret || secret !== expectedSecret) {
      console.warn('[revalidate] Unauthorized access attempt');
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    // Handle Path-based revalidation (e.g., from SEO Metadata updates)
    if (path) {
      console.log(`[revalidate] Purging path ${path}`);
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, path });
    }

    // Handle Tag-based revalidation (e.g., from stocks-service queue)
    if (tag) {
      console.log(`[revalidate] Purging tag ${tag} stockId=${stockId ?? 'all'}`);
      revalidateTag(tag, { expire: 0 });
      
      // If specific stockId is provided, revalidate its specific path too
      if (stockId) {
        revalidatePath(`/stocks/[id]`, 'page');
      } else {
        revalidatePath('/stocks');
      }
      
      // Also always refresh the home page and dynamic sitemap if stocks change
      revalidatePath('/');
      revalidatePath('/sitemap.xml');

      return NextResponse.json({ revalidated: true, tag, stockId });
    }

    // Handle Slug-based revalidation (Existing CMS logic)
    if (slug) {
      const pagePath = SLUG_TO_PATH[slug];
      if (!pagePath) {
        console.warn(`[revalidate] Unknown slug: ${slug}`);
        return NextResponse.json(
          { message: `Unknown slug: ${slug}` },
          { status: 400 },
        );
      }

      console.log(`[revalidate] Purging tag static-page-${slug} + path ${pagePath}`);
      revalidateTag(`static-page-${slug}`, { expire: 0 });
      revalidatePath(pagePath);
      revalidatePath('/sitemap.xml');

      return NextResponse.json({ revalidated: true, path: pagePath, tag: `static-page-${slug}` });
    }

    return NextResponse.json(
      { message: 'Missing slug, tag, or path' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[revalidate] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
