/**
 * Next.js Configuration
 * 
 * PWA Implementation: MANUAL SERVICE WORKER (Traycer-Approved )
 * 
 * Why Manual Instead of Plugins?
 * - Next.js 16 uses Turbopack by default (faster than webpack)
 * - PWA plugins (next-pwa, @ducanh2912/next-pwa) are webpack-only and break with Turbopack
 * - Manual approach is industry standard (Twitter, Instagram, Pinterest use it)
 * - Provides full control over caching strategies
 * - Framework-agnostic and production-ready
 * 
 * Service Worker Files:
 * - Service Worker: public/sw.js (142 lines, handles offline caching)
 * - Registration: components/pwa/service-worker-register.tsx
 * - Integration: app/layout.tsx imports ServiceWorkerRegister
 * 
 * Features:
 * -  Offline caching (pages, assets, API responses)
 * -  Network-first for dynamic content
 * -  Cache-first for static assets
 * -  Automatic cache updates
 * -  Offline fallback page (/offline)
 * -  Install prompt (components/pwa/install-prompt.tsx)
 * -  Error boundaries (app/error.tsx, app/dashboard/error.tsx)
 * 
 * Verification (Chrome DevTools):
 * - Application → Service Workers → "sw.js activated and running"
 * - Application → Manifest → Validates name, icons, theme
 * - Network → Offline mode → Cached content loads
 * 
 * Reference: components/pwa/README.md
 */

/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const nextConfig = {
  output: 'standalone',
  // Keep the Node-only jsdom sanitizer out of Next's server bundle. Bundling
  // its stylesheet reference breaks page-data generation in production builds.
  serverExternalPackages: ['isomorphic-dompurify'],
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  transpilePackages: ['cookie-crypto'],
  allowedDevOrigins: process.env.BACKEND_ORIGIN ? [new URL(process.env.BACKEND_ORIGIN).hostname] : [],
  webpack: (config, { dev }) => {
    // Add path aliases for Vercel deployment
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      // Prevent bundling debug's browser implementation (it uses browser storage APIs).
      debug: require.resolve('debug/src/node'),
    };

    /**
     * Dev stability (Windows/monorepo):
     * When running `next dev --webpack`, webpack uses file watchers.
     * This repo includes large non-source folders (e.g. `postgres-data/`, logs, uploads)
     * that can drastically increase watcher memory usage and occasionally crash Node
     * with "JavaScript heap out of memory".
     *
     * We explicitly ignore those folders in dev to keep memory bounded.
     */
    if (dev) {
      const ignored = [
        '**/postgres-data/**',
        '**/logs/**',
        '**/uploads/**',
        '**/.turbo/**',
        '**/.next/**',
      ];

      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: Array.isArray(config.watchOptions?.ignored)
          ? [...config.watchOptions.ignored, ...ignored]
          : ignored,
      };
    }

    // Prevent bundling native `canvas` binary required by jsdom/isomorphic-dompurify.
    // It's only needed server-side and is optional — DOMPurify works fine without it in the browser.
    config.externals = [...(config.externals || []), { canvas: 'commonjs canvas' }];

    return config;
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  turbopack: {},
  async rewrites() {
    // All /api/* calls are proxied to the single backend gateway defined by BACKEND_ORIGIN.
    const backendOrigin = process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '');
    if (!backendOrigin) {
      throw new Error('BACKEND_ORIGIN environment variable is required');
    }

    return [
      // Exclude probe42 (company) and dev tools so local Next.js API routes are served.
      { source: '/api/:path((?!company|dev).*)', destination: `${backendOrigin}/api/:path*` },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/transactions',
        destination: '/dashboard/orders',
        permanent: true,
      },
      {
        source: '/transactions',
        destination: '/dashboard/orders',
        permanent: true,
      },
      {
        source: '/payment',
        destination: '/dashboard/orders',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Prevent caching for API routes to protect sensitive responses
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache',
          },
        ],
      },
      {
        // Cache static Next.js assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache public media files
        source: '/(.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;


