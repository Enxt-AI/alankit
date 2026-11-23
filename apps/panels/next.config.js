/**
 * Next.js Configuration
 */

/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const nextConfig = {
  output: 'standalone',
  basePath: process.env.NEXT_BASE_PATH || undefined,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  webpack: (config) => {
    // Add path aliases for Vercel deployment
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      // Prevent bundling debug's browser implementation (it uses browser storage APIs).
      debug: require.resolve('debug/src/node'),
    };
    return config;
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  turbopack: {},
  async redirects() {
    return [
      {
        source: '/cms/demat-approval',
        destination: '/operation/demat-approval',
        permanent: false,
      },
      {
        source: '/cms/demat-pending',
        destination: '/operation/demat-approval',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    // Client now calls backend services directly; no proxy rewrites.
    return [];
  },
  async headers() {
    return [
      {
        // Prevent caching for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache',
          },
        ],
      },
      {
        // Prevent caching for all panel pages (authenticated routes, excluding api)
        source: '/:path((?!_next|api|static|public|favicon\\.ico).*)',
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
        // Cache public media files (excluding dynamic /storage/ proxy)
        source: '/((?!storage/).*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf))',
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


