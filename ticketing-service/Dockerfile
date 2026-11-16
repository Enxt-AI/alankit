# Multi-stage Dockerfile for ticketing-service in the monorepo
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

# Copy only the package manifests required for ticketing-service build context
# This minimizes the build context size and improves build performance
# ticketing-service depends on: db-ticketing (Prisma), db-unlisted-stox (Prisma), email-service (TypeScript utility), shared-types (TypeScript types), stats-types (TypeScript types)
COPY packages/db-ticketing/package.json packages/db-ticketing/
COPY packages/db-unlisted-stox/package.json packages/db-unlisted-stox/
COPY packages/redis-service/package.json packages/redis-service/
COPY packages/email-service/package.json packages/email-service/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/stats-types/package.json packages/stats-types/
COPY packages/cookie-crypto/package.json packages/cookie-crypto/
COPY packages/logger/package.json packages/logger/
COPY apps/ticketing-service/package.json apps/ticketing-service/
COPY packages/typescript-config/package.json packages/typescript-config/

# Install all dependencies including dev dependencies for building
# --frozen-lockfile ensures reproducible builds using exact versions from lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source only after installing dependencies to preserve the install cache.
COPY packages/db-ticketing/ packages/db-ticketing/
COPY packages/db-unlisted-stox/ packages/db-unlisted-stox/
COPY packages/redis-service/ packages/redis-service/
COPY packages/email-service/ packages/email-service/
COPY packages/shared-types/ packages/shared-types/
COPY packages/stats-types/ packages/stats-types/
COPY packages/cookie-crypto/ packages/cookie-crypto/
COPY packages/logger/ packages/logger/
COPY apps/ticketing-service/ apps/ticketing-service/
COPY packages/typescript-config/ packages/typescript-config/

# Build arguments for Prisma client generation (required at build time)
ARG DATABASE_URL
ARG TICKETING_DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV TICKETING_DATABASE_URL=$TICKETING_DATABASE_URL

# Generate Prisma clients for both database packages
# This must happen before building the packages or any dependent services
# Clients are generated to custom output paths: ../generated/prisma
RUN cd packages/db-unlisted-stox && pnpm run generate
RUN cd packages/db-ticketing && pnpm run generate

# Build shared packages in dependency order
# Database packages must be built first as they contain Prisma clients
RUN cd packages/db-unlisted-stox && pnpm run build
RUN cd packages/db-ticketing && pnpm run build

# redis-service is a TypeScript utility package used by ticketing-service
RUN cd packages/redis-service && pnpm run build

# email-service is a TypeScript utility package used by ticketing-service
RUN cd packages/email-service && pnpm run build

# shared-types and stats-types are TypeScript type packages used by ticketing-service
RUN cd packages/shared-types && pnpm run build
RUN cd packages/stats-types && pnpm run build

# cookie-crypto provides AES-256-GCM encryption/decryption for cookie values
RUN cd packages/cookie-crypto && pnpm run build

# logger provides the shared structured pino logger used by ticketing-service
RUN cd packages/logger && pnpm run build

# Build the ticketing-service NestJS application
# This compiles TypeScript to JavaScript in the dist/ directory
RUN cd apps/ticketing-service && pnpm run build

# Use pnpm deploy to create an isolated deployment directory
# --filter=ticketing-service targets only the ticketing-service workspace
# --prod includes only production dependencies, excluding dev dependencies
# This resolves workspace:* protocol dependencies to actual file paths
# Output is placed in /app/deploy for the production stage to copy
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm deploy --filter=ticketing-service --prod /app/deploy

# Copy generated Prisma clients to the deployed packages
# pnpm deploy doesn't include generated files, so we copy them manually
RUN cp -r /app/packages/db-unlisted-stox/generated /app/deploy/node_modules/.pnpm/db-unlisted-stox@file+packages+db-unlisted-stox*/node_modules/db-unlisted-stox/
RUN cp -r /app/packages/db-ticketing/generated /app/deploy/node_modules/.pnpm/db-ticketing@file+packages+db-ticketing*/node_modules/db-ticketing/

# Production stage: Creates minimal runtime image
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling in containers
# Handles PID 1 responsibilities: signal forwarding and zombie process reaping
RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache dumb-init

# Set production environment to disable debug features and optimize performance
ENV NODE_ENV=production

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

# Create uploads directory and ensure permissions
RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

# Switch to non-root user for security
USER nestjs

# Expose the port that ticketing-service listens on
EXPOSE 3001

# Set Node.js memory limit to 200MB to fit within 1GB EC2 t2.micro constraints
# Approximately 250MB available per service after OS overhead
ENV NODE_OPTIONS="--max-old-space-size=200"

# Use dumb-init as entrypoint to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the NestJS application
# dist/main.js is the compiled entry point
CMD ["node", "dist/main.js"]
