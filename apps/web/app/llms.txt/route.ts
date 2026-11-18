import { NextResponse } from "next/server";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://www.unlistedstox.com";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // 24 hours

export async function GET() {
  const body = `# UnlistedStox

## Summary
Buy curated pre-IPO and unlisted shares from high-growth Indian companies with secure off-market transfers, backed by SMC Group.

## What we are
UnlistedStox is a pre-IPO / unlisted share marketplace for retail investors in India. Users can discover, buy, and hold unlisted shares through demat-to-demat off-market transfers settled via CDSL or NSDL.

## Key pages
- Homepage: ${baseUrl}/
- All unlisted stocks: ${baseUrl}/stocks
- Unlisted share price list (table): ${baseUrl}/unlisted-shares-price-list
- Upcoming pre-IPO / coming soon: ${baseUrl}/upcoming-stocks
- Curated investment baskets: ${baseUrl}/baskets
- Articles & insights: ${baseUrl}/articles
- Market news: ${baseUrl}/news
- About us: ${baseUrl}/about
- Support: ${baseUrl}/supports
- Legal & policies: ${baseUrl}/legal-policies

## Contact
- Email: support@unlistedstox.com
- Phone: +91 9911944094

## Crawl policy
All AI/LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, OAI-SearchBot, BingChat) are explicitly allowed. See /robots.txt for the full, auditable policy.
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
