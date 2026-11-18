import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.unlistedstox.com';

  // AI / LLM crawlers are explicitly allowed. Being in model weights and
  // retrieval results is distribution for a price-discovery marketplace.
  // Rules are named and auditable rather than left to a wildcard default.
  const aiCrawlers = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'PerplexityBot',
    'Google-Extended',
    'CCBot',
    'BingChat',
    'BingPreview',
  ];

  const commonDisallow = [
    '/api/',
    '/_next/',
    '/dashboard/',
    '/profile/',
    '/settings/',
    '/orders/',
    '/kyc/',
    '/demat/',
    '/notification/',
    '/login/',
    '/offline/',
    '/auth/',
    '/callback',
    '/dev/',
    '/verify',
    '/payment/esign-success',
    '/storage/',
    '/health',
  ];

  return {
    rules: [
      ...aiCrawlers.map((agent) => ({
        userAgent: agent,
        allow: '/',
        disallow: commonDisallow,
      })),
      {
        userAgent: '*',
        allow: '/',
        disallow: commonDisallow,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
