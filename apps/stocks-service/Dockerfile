# Multi-stage Dockerfile for stocks-service in the monorepo
# This Dockerfile uses pnpm workspaces with Turborepo orchestration
# Builder stage handles dependency installation, Prisma generation, and builds
# Production stage creates a minimal runtime image with only necessary files

# Builder stage: Installs dependencies, generates Prisma clients, builds packages and service
FROM node:22-alpine AS builder

# Set working directory for the entire build process
WORKDIR /app

# Copy root-level workspace configuration files first for better layer caching
# These files define the monorepo structure and dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Install pnpm globally to manage workspace dependencies
# Using specific version 9.0.0 for reproducibility
# Persistent pnpm store (BuildKit cache mount) shared by install and deploy across builds
ENV npm_config_store_dir=/pnpm/store
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm install -g pnpm@9.0.0

# Copy only the package manifests required for stocks-service build context
# This minimizes the build context size and improves build performance
# stocks-service depends on: db-unlisted-stox (Prisma), redis-service (TypeScript utility), email-service (TypeScript utility)
COPY packages/db-unlisted-stox/package.json packages/db-unlisted-stox/
COPY packages/redis-service/package.json packages/redis-service/
COPY packages/email-service/package.json packages/email-service/
COPY packages/cookie-crypto/package.json packages/cookie-crypto/
COPY packages/logger/package.json packages/logger/
COPY apps/stocks-service/package.json apps/stocks-service/
COPY packages/typescript-config/package.json packages/typescript-config/

# Skip Chromium download during pnpm install AND pnpm deploy postinstall scripts
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install all dependencies including dev dependencies for building
# --frozen-lockfile ensures reproducible builds using exact versions from lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source only after installing dependencies to preserve the install cache.
COPY packages/db-unlisted-stox/ packages/db-unlisted-stox/
COPY packages/redis-service/ packages/redis-service/
COPY packages/email-service/ packages/email-service/
COPY packages/cookie-crypto/ packages/cookie-crypto/
COPY packages/logger/ packages/logger/
COPY apps/stocks-service/ apps/stocks-service/
COPY packages/typescript-config/ packages/typescript-config/

# Build argument for Prisma client generation (required at build time)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma client for db-unlisted-stox package
# This must happen before building the package or any dependent services
# The client is generated to custom output path: ../generated/prisma
RUN cd packages/db-unlisted-stox && pnpm run generate

# Build shared packages in dependency order
# db-unlisted-stox must be built first as it contains the Prisma client
RUN cd packages/db-unlisted-stox && pnpm run build

# redis-service is a TypeScript utility package used by stocks-service
RUN cd packages/redis-service && pnpm run build

# email-service is a TypeScript utility package used by stocks-service
RUN cd packages/email-service && pnpm run build

# cookie-crypto provides AES-256-GCM encryption/decryption for cookie values
RUN cd packages/cookie-crypto && pnpm run build

# logger provides the shared structured pino logger used by stocks-service
RUN cd packages/logger && pnpm run build

# Build the stocks-service NestJS application
# This compiles TypeScript to JavaScript in the dist/ directory


# Force rebuild to invalidate stale docker deploy cache
RUN cd apps/stocks-service && pnpm run build

# Use pnpm deploy to create an isolated deployment directory
# --filter=stocks-service targets only the stocks-service workspace
# --prod includes only production dependencies, excluding dev dependencies
# --ignore-scripts prevents puppeteer and other packages from running their
#   postinstall scripts (e.g. Chromium download) in the clean deploy directory.
#   The Prisma client is copied manually below, so skipping scripts is safe.
# This resolves workspace:* protocol dependencies to actual file paths
# Output is placed in /app/deploy for the production stage to copy
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm deploy --filter=stocks-service --prod --ignore-scripts /app/deploy

# Fail the image build immediately if the production entrypoint is missing.
# stocks-service is expected to follow the same dist/main.js contract as the
# other NestJS services, so this catches packaging drift before EC2 deploy.
RUN test -f /app/deploy/dist/main.js
RUN test -f /app/deploy/dist/esign-worker.js

# Copy generated Prisma client to the deployed package
# pnpm deploy doesn't include generated files, so we copy them manually
RUN cp -r /app/packages/db-unlisted-stox/generated /app/deploy/node_modules/.pnpm/db-unlisted-stox@file+packages+db-unlisted-stox*/node_modules/db-unlisted-stox/

# Production stage: Creates minimal runtime image
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling in containers
# Also install chromium and its dependencies for Puppeteer PDF generation
RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache dumb-init chromium nss freetype harfbuzz ca-certificates fontconfig font-freefont ttf-dejavu

# Set production environment to disable debug features and optimize performance
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user for security best practices
# Group ID 1001, User ID 1001 to avoid conflicts with host system
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Ensure the application directory exists and is writable by the non-root user.
# Without this, /app (created by WORKDIR as root) may be non-writable, causing EACCES at runtime.
RUN mkdir -p /app && chown nestjs:nodejs /app

# Set working directory for the application
WORKDIR /app

# Copy the deployed application from builder stage
# --chown ensures files are owned by the non-root user
# Only production dependencies and built code are included
COPY --from=builder --chown=nestjs:nodejs /app/deploy /app

# Create uploads directories used by KYC and ensure permissions.
RUN mkdir -p /app/uploads/kyc && chown -R nestjs:nodejs /app/uploads

# Switch to non-root user for security
USER nestjs

# Expose the port that stocks-service listens on
EXPOSE 3003

# Set Node.js memory limit to 200MB to fit within 1GB EC2 t2.micro constraints
# Approximately 250MB available per service after OS overhead
ENV NODE_OPTIONS="--max-old-space-size=200"

# Use dumb-init as entrypoint to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the NestJS application
# dist/main.js is the compiled entry point
CMD ["node", "dist/main.js"]
