# Multi-stage Dockerfile for storage-service
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Persistent pnpm store (BuildKit cache mount) shared by install and deploy across builds
ENV npm_config_store_dir=/pnpm/store
RUN --mount=type=cache,id=npm-cache,target=/root/.npm npm install -g pnpm@9.0.0

COPY apps/storage-service/package.json apps/storage-service/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/cookie-crypto/package.json packages/cookie-crypto/
COPY packages/logger/package.json packages/logger/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source only after installing dependencies to preserve the install cache.
COPY apps/storage-service/ apps/storage-service/
COPY packages/typescript-config/ packages/typescript-config/
COPY packages/cookie-crypto/ packages/cookie-crypto/
COPY packages/logger/ packages/logger/
RUN cd packages/cookie-crypto && pnpm run build
RUN cd packages/logger && pnpm run build
RUN cd apps/storage-service && pnpm run build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm deploy --filter=storage-service --prod /app/deploy

FROM node:22-alpine AS production
RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --update-cache dumb-init
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/deploy /app
USER nestjs
EXPOSE 3005
ENV NODE_OPTIONS="--max-old-space-size=200"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
