import type { NextConfig } from "next";

const backendOrigin = process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // Client now calls backend services directly; no proxy rewrites.
    return [];
  },
};

export default nextConfig;
