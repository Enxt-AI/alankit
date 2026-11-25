# Multi-stage Dockerfile for the standalone Alankit Next.js app.

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BACKEND_ORIGIN
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
ARG NEXT_PUBLIC_AUTH_SERVICE_URL
ARG NEXT_PUBLIC_STOCKS_SERVICE_URL
ARG NEXT_PUBLIC_PAYMENTS_SERVICE_URL
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_STOCKS_SERVICE_URL=$NEXT_PUBLIC_STOCKS_SERVICE_URL
ENV NEXT_PUBLIC_PAYMENTS_SERVICE_URL=$NEXT_PUBLIC_PAYMENTS_SERVICE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:22-alpine AS production

RUN --mount=type=cache,id=apk-cache,target=/etc/apk/cache,sharing=locked apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/next-env.d.ts ./next-env.d.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
