# Multi-stage Dockerfile for the panels application (Next.js) in the monorepo
# Uses pnpm workspaces and Next.js standalone output for optimal image size

# Builder stage: Installs dependencies and builds the application
FROM node:22-alpine AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache libc6-compat
WORKDIR /app

# Copy root-level workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Install pnpm globally
# Persistent pnpm store (BuildKit cache mount) shared by install and deploy across builds
ENV npm_config_store_dir=/pnpm/store
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm install -g pnpm@9.0.0

# Copy dependency manifests for the panels app
COPY packages/ui/package.json packages/ui/
COPY packages/cookie-crypto/package.json packages/cookie-crypto/
COPY packages/stats-types/package.json packages/stats-types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/panels/package.json apps/panels/

# Install dependencies using frozen lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source only after installing dependencies to preserve the install cache.
COPY packages/ui/ packages/ui/
COPY packages/cookie-crypto/ packages/cookie-crypto/
COPY packages/stats-types/ packages/stats-types/
COPY packages/typescript-config/ packages/typescript-config/
COPY packages/eslint-config/ packages/eslint-config/
COPY apps/panels/ apps/panels/

# Build the panels application using Turborepo to ensure workspace dependencies are handled
ARG BACKEND_ORIGIN
ARG NEXT_BASE_PATH
ARG NEXT_PUBLIC_BASE_PATH
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
ENV NEXT_BASE_PATH=$NEXT_BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx turbo run build --filter=panels

# Production stage: Creates a minimal runtime image
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache dumb-init

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy public folder for static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/panels/public ./apps/panels/public

# Copy the standalone output which Next.js generates
# This includes the traced node_modules and the minimal required code
COPY --from=builder --chown=nextjs:nodejs /app/apps/panels/.next/standalone ./

# Copy the static folder (standalone doesn't include it by default)
COPY --from=builder --chown=nextjs:nodejs /app/apps/panels/.next/static ./apps/panels/.next/static

# Switch to non-root user
USER nextjs

EXPOSE 4000

ENV PORT=4000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js standalone server
# In a monorepo, the standalone output retains the folder structure, so server.js is at apps/panels/server.js
CMD ["node", "apps/panels/server.js"]
