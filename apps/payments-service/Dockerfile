# Multi-stage Dockerfile for payments-service in the monorepo
# This Dockerfile uses pnpm workspaces with Turborepo orchestration

# Builder stage
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Persistent pnpm store (BuildKit cache mount) shared by install and deploy across builds
ENV npm_config_store_dir=/pnpm/store
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm install -g pnpm@9.0.0

COPY packages/db-unlisted-stox/package.json packages/db-unlisted-stox/
COPY packages/cookie-crypto/package.json packages/cookie-crypto/
COPY packages/email-service/package.json packages/email-service/
COPY packages/redis-service/package.json packages/redis-service/
COPY packages/logger/package.json packages/logger/
COPY packages/typescript-config/package.json packages/typescript-config/

COPY apps/payments-service/package.json apps/payments-service/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source only after installing dependencies to preserve the install cache.
COPY packages/db-unlisted-stox/ packages/db-unlisted-stox/
COPY packages/cookie-crypto/ packages/cookie-crypto/
COPY packages/email-service/ packages/email-service/
COPY packages/redis-service/ packages/redis-service/
COPY packages/logger/ packages/logger/
COPY packages/typescript-config/ packages/typescript-config/
COPY apps/payments-service/ apps/payments-service/

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

RUN cd packages/db-unlisted-stox && pnpm run generate
RUN cd packages/db-unlisted-stox && pnpm run build
RUN cd packages/cookie-crypto && pnpm run build
RUN cd packages/email-service && pnpm run build
RUN cd packages/redis-service && pnpm run build
RUN cd packages/logger && pnpm run build

RUN cd apps/payments-service && pnpm run build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm deploy --filter=payments-service --prod /app/deploy
RUN test -f /app/deploy/dist/main.js
RUN cp -r /app/packages/db-unlisted-stox/generated /app/deploy/node_modules/.pnpm/db-unlisted-stox@file+packages+db-unlisted-stox*/node_modules/db-unlisted-stox/

# Production stage
FROM node:22-alpine AS production

RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache dumb-init
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
RUN mkdir -p /app && chown nestjs:nodejs /app

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/deploy /app

USER nestjs
EXPOSE 3004

ENV NODE_OPTIONS="--max-old-space-size=200"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
