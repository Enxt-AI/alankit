import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // BACKEND_ORIGIN is used only server-side (rewrites). Not exposed to the browser
  // so all client fetch calls go through the same-origin Next.js proxy.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache',
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Proxy backend /api/* calls to the single backend gateway defined by BACKEND_ORIGIN.
    const backendOrigin = process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '');
    if (!backendOrigin) {
      throw new Error('BACKEND_ORIGIN environment variable is required');
    }

    return [
      { source: '/api/auth/:path*', destination: `${backendOrigin}/api/auth/:path*` },
      { source: '/api/stocks/:path*', destination: `${backendOrigin}/api/stocks/:path*` },
      { source: '/api/orders/:path*', destination: `${backendOrigin}/api/orders/:path*` },
      // Health check is now handled locally via app/api/health/route.ts
    ];
  },
};

export default nextConfig;
