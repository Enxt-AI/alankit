/**
 * Server-side verification gate for checkout entry points.
 *
 * Used by the buy pages (`/stocks/[id]/buy`, `/baskets/[id]/buy`) inside
 * React Server Components, BEFORE any page content renders. Direct URL entry
 * therefore cannot skip the KYC → Demat → Bank chain, the same way the
 * middleware already blocks unauthenticated visits.
 *
 * Design notes:
 * - Authenticated server-to-service calls forward the request cookies.
 *   The backend session check only rejects a device fingerprint when a
 *   *mismatching* one is sent, so omitting `x-device-fingerprint`
 *   server-side passes validation.
 * - Fail-open on backend errors (timeout/down): the page still renders and
 *   the existing client-side guards (auth modal, verification checklist,
 *   Proceed-time redirects) apply. Only a definitive 401 (stale session)
 *   or a definitive non-VERIFIED status triggers a redirect.
 * - statuses are fetched in parallel; the redirect chain is evaluated in
 *   order: KYC first, then Demat, then Bank.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Resolve the stocks-service base URL (server-side only). */
function getStocksApiBase(): string {
  const gateway = (process.env.BACKEND_ORIGIN || "")
    .trim()
    .replace(/\/api$/, "")
    .replace(/\/$/, "");
  const isDocker = process.env.NODE_ENV === "production";
  // Direct service host avoids the nginx hop inside Docker; on hosts without
  // a gateway configured, fall back to local dev ports.
  const origin = isDocker
    ? "http://stocks-service:3003"
    : gateway || "http://127.0.0.1:3003";
  return `${origin}/api`;
}

interface StatusFetch {
  status: number;
  body: any;
}

/** GET a JwtAuthGuard-protected status endpoint, forwarding auth cookies. */
async function fetchStatus(
  path: string,
  cookieHeader: string,
): Promise<StatusFetch | null> {
  try {
    const res = await fetch(`${getStocksApiBase()}${path}`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
      // Fail fast so a slow backend never hangs the buy page render.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: res.status, body: null };
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/**
 * Fetch KYC/Demat/Bank statuses for the request cookies.
 * Cached per request so generateMetadata + page component share a single
 * backend round-trip.
 */
const getVerificationStatuses = cache(async (cookieHeader: string) => {
  const [kyc, demat, bank] = await Promise.all([
    fetchStatus("/kyc/status", cookieHeader),
    fetchStatus("/demat/status", cookieHeader),
    fetchStatus("/bank/status", cookieHeader),
  ]);
  return { kyc, demat, bank };
});

/**
 * Redirect unauthenticated users to login and users with an incomplete
 * verification chain to the first missing step. Resolves silently when
 * everything is verified (or when the backend cannot be reached).
 *
 * Call from BOTH generateMetadata and the page component: metadata streams
 * first, so gating only in the page yields a delayed meta-refresh redirect
 * instead of a crisp 307. Gating in metadata produces the 307 on initial
 * load; the page-level call covers client-side navigations.
 *
 * @param returnUrl - the buy page path, preserved through login/verification
 */
export async function enforceBuyVerification(
  returnUrl: string,
): Promise<void> {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const encoded = encodeURIComponent(returnUrl);

  // No cookies at all (middleware normally catches this first).
  if (all.length === 0) {
    redirect(`/login?returnUrl=${encoded}`);
  }

  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");
  const { kyc, demat, bank } = await getVerificationStatuses(cookieHeader);

  // Backend unreachable → fail open; client-side guards still apply.
  if (!kyc || !demat || !bank) return;

  // Cookie present but session invalid/expired → fresh login.
  if (kyc.status === 401 || demat.status === 401 || bank.status === 401) {
    redirect(`/login?returnUrl=${encoded}`);
  }

  // NOTE: /kyc/status returns a flat { kycStatus } payload, while demat/bank
  // status endpoints wrap theirs in { data: { ...Status } }.
  if (kyc.body?.kycStatus !== "VERIFIED") {
    redirect(`/kyc?returnUrl=${encoded}`);
  }
  if (demat.body?.data?.dematStatus !== "VERIFIED") {
    redirect(`/demat?returnUrl=${encoded}`);
  }
  if (bank.body?.data?.bankStatus !== "VERIFIED") {
    redirect(`/bank?returnUrl=${encoded}`);
  }
}
