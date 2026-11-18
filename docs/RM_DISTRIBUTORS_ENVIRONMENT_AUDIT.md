# RM Distributors service environment-variable audit

Audited `apps/rm-distributors` on 2026-10-17. No `.env` files or examples were read or used to determine requirements.

Coverage: full-content environment-access scan of **69 text files / 11,128 lines**, plus inventory of **16 binary assets**, including hidden files. Excluded dependencies, generated build directories and TypeScript build caches. Reviewed environment consumers, API helpers/callers, shared cookie implementation, the declared email dependency, Dockerfile, root `.dockerignore`, staging Compose and Turbo configuration. `RM_DISTRIBUTORS_ENVIRONMENT_FILE_AUDIT.json` records every scanned file and environment-reference line.

Found **6 application/configuration variables**, plus **5 deployment/tooling settings**. Compose additionally supplies **2 unused MinIO settings**, listed separately below. There are **no NEXT_PUBLIC_* environment references** in this application.

## Build-time application settings

| Variable | Purpose / default | Required? | Source under `apps/rm-distributors` |
|---|---|---|---|
| `BACKEND_ORIGIN` | Optional gateway origin. When present, rewrites auth, stocks and order API requests through it. Otherwise direct service routing is used. | Only when choosing gateway routing. Build-time only in this app. | `next.config.ts:24` |
| `AUTH_SERVICE_URL` | Direct auth rewrite origin. Default: `http://auth-service:3002` when production and VERCEL is unset; otherwise `http://127.0.0.1:3002`. | Only to override direct-service defaults; ignored as a destination when BACKEND_ORIGIN is set. | `next.config.ts:26` |
| `STOCKS_SERVICE_URL` | Direct stocks/orders/health rewrite origin. Default: `http://stocks-service:3003` when production and VERCEL is unset; otherwise `http://127.0.0.1:3003`. | Only to override direct-service defaults; ignored as a destination when BACKEND_ORIGIN is set. | `next.config.ts:27` |
| `VERCEL` | Truthy platform flag disables production-is-Docker inference when selecting default service origins. | Leave unset in Docker. Normally provided by Vercel when deployed there. | `next.config.ts:25` |

Use **bare absolute origins**, including scheme and port where necessary, without `/api`. BACKEND_ORIGIN removes one trailing slash; AUTH_SERVICE_URL and STOCKS_SERVICE_URL are used as-is, so omit trailing slashes from those too. This config does not normalize an appended `/api` away.

For example, direct routing uses `<AUTH_SERVICE_URL>/api/auth/...` and `<STOCKS_SERVICE_URL>/api/stocks/...`. Passing a service URL already ending in `/api` would duplicate the path segment.

The health route is intentionally worth checking against the gateway: `/api/health` rewrites to `<BACKEND_ORIGIN>/health` in gateway mode, but `<STOCKS_SERVICE_URL>/api/health` in direct mode.

These settings generate rewrites during `next build`. The standalone server uses the built routing configuration; passing different origins only to the running container does not regenerate those rewrites. Unlike the web and Panels services, this app has no application request-time reads of BACKEND_ORIGIN, AUTH_SERVICE_URL or STOCKS_SERVICE_URL.

## Build + runtime application setting

| Variable | Usage | Configuration |
|---|---|---|
| `NODE_ENV` | Build: console removal and Docker/local origin inference in `next.config.ts:8,25`. Application error logging also checks it in `app/error.tsx:13`. Runtime: production Next.js server mode. | Use `production` for production and staging deployments. `next build` uses production when unset; Dockerfile sets `production` in its runtime stage. Do not set it to `staging`. |

## Runtime-only application setting

| Variable | Usage / requirement | Source |
|---|---|---|
| `COOKIE_ENCRYPTION_KEY` | Secret used to decrypt Distributor, internal RM, distributor RM and Branch session cookies. For encrypted-cookie authentication, supply the **same 64-character hexadecimal AES-256 key** used by the backend issuing those cookies. | `apps/rm-distributors/proxy.ts:71`; `packages/cookie-crypto/src/index.ts` |

Missing or incorrect keys cause encrypted-cookie decryption to return null and protected routes to redirect to the relevant login page. The shared helper supports legacy unencrypted JWT-shaped tokens and opaque session IDs, so the app does not universally reject every cookie when the key is missing. Configure the key for the encrypted-cookie deployment; do not rely on the legacy fallback.

The key is read inside request processing, not during module initialization. There is no build-time key requirement or startup key validation in this application. Its presence in Turbo's globalEnv does not make it a required build input. Keep it in runtime secret configuration and never create a public version of it.

## Additional deployment/tooling settings

| Variable | Phase | Existing configuration / behavior |
|---|---|---|
| `PORT` | Runtime | Dockerfile sets `8000`; Compose maps `8000:8000`. The standalone server reads it. The `dev` script explicitly selects port 8000; the `start` script is only `next start`, so outside Docker set PORT=8000 if you want that port instead of Next.js's default 3000. |
| `HOSTNAME` | Runtime | Dockerfile sets `0.0.0.0` for standalone server binding. |
| `NEXT_TELEMETRY_DISABLED` | Build + runtime | Dockerfile sets `1` in both stages. |
| `NODE_OPTIONS` | Runtime in current Compose | Staging Compose sets `--dns-result-order=ipv4first`. General Node process setting; not directly read by application code. |
| `npm_config_store_dir` | Build tooling | Dockerfile sets `/pnpm/store` for dependency-cache configuration. Not needed by the application at runtime. |

Sources: `apps/rm-distributors/Dockerfile:16,41,53-55,75-77`, `apps/rm-distributors/package.json:6-8`, `docker-compose.staging.yml:348-362`.

## Settings that are not requirements for this app

- `MINIO_ENDPOINT` and `MINIO_PUBLIC_URL` are supplied by staging Compose, but there are no application reads or storage-proxy handlers consuming them in this service. They do not configure RM Distributors behavior.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `EMAIL_FROM` are read by the shared `email-service` implementation, but RM Distributors does not import or instantiate that service. It is listed in package dependencies and copied/built by Docker; those facts do not execute its constructor or require its settings. The package's build command is TypeScript compilation. These email values are not current build/runtime requirements for this frontend service.
- `REVALIDATION_SECRET` is in root Turbo globalEnv, but has no application consumer here.
- No reads of `NEXT_PUBLIC_*`, DATABASE_URL, JWT_SECRET, PANELS_URL, ticketing/payment/storage service URL variables or payment-provider secret keys were found. Browser API calls use relative `/api/...` paths, and cookie names come from shared constants.

## Current deployment gaps

1. **The Dockerfile declares no build ARGs.** It runs `npx turbo run build --filter=rm-distributors`, but offers no way to supply custom routing origins via build arguments without adding Dockerfile plumbing. Passing arbitrary `--build-arg` names alone will not configure the build.
2. **Compose configures BACKEND_ORIGIN at the wrong phase for this service.** `docker-compose.staging.yml:356-362` supplies an env_file and BACKEND_ORIGIN at container runtime. Root `.dockerignore` excludes nested `.env*` files, so the app's env_file is also not copied into the image build. As written, the runtime gateway setting does not replace the baked direct Docker-service rewrite destinations.
3. **Private custom build inputs need Turbo configuration.** BACKEND_ORIGIN is already in globalEnv. AUTH_SERVICE_URL and STOCKS_SERVICE_URL are not. If overriding them, add them to task `env` or `globalEnv` so Turbo strict mode and cache hashing account for them. Account for VERCEL as well when targeting that platform. COOKIE_ENCRYPTION_KEY and REVALIDATION_SECRET in globalEnv do not imply those secrets are needed to build this app.

## Copyable phase lists

These lists identify supported inputs, not a requirement to populate every optional setting.

Build-time application settings:

```text
BACKEND_ORIGIN
AUTH_SERVICE_URL
STOCKS_SERVICE_URL
VERCEL
NODE_ENV
```

Use BACKEND_ORIGIN for gateway routing, or AUTH_SERVICE_URL/STOCKS_SERVICE_URL for direct routing overrides. If the existing Docker service names and ports are correct, the routing overrides can all remain unset. Leave VERCEL unset in Docker.

Runtime application settings:

```text
COOKIE_ENCRYPTION_KEY
NODE_ENV
```

Deployment/tooling settings already configured by Docker/Compose:

```text
# Build
NEXT_TELEMETRY_DISABLED=1
npm_config_store_dir=/pnpm/store

# Runtime
PORT=8000
HOSTNAME=0.0.0.0
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--dns-result-order=ipv4first
```

For the intended gateway deployment, provide BACKEND_ORIGIN at build time and COOKIE_ENCRYPTION_KEY at runtime, retaining the current production/port/bind settings. Wire the build setting through Docker and Compose first; the existing runtime env_file is insufficient.

Validation: full file-content scan for direct and indirect environment access, consumer/dependency review, and inventory-to-report coverage check. No application or deployment configuration was changed. No production build or live backend calls were performed.

Framework references: [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables), [Turborepo environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).
