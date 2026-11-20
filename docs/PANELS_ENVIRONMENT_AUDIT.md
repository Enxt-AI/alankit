# Panels service environment-variable audit

Audited `apps/panels` on 2026-10-17 without reading or relying on any `.env` files or examples.

Coverage: full-content environment-access scan of **440 text files / 103,375 lines**, plus an inventory of **46 binary assets**, including hidden files. Dependencies, generated build directories and TypeScript build caches were excluded. Reviewed the environment consumers, their callers, workspace imports, Dockerfile, `.dockerignore`, staging Compose and Turbo configuration. The companion `PANELS_ENVIRONMENT_FILE_AUDIT.json` lists every scanned file and reference line.

Found **16 application/configuration variables**, plus **5 deployment/tooling variables**. Not every variable is mandatory: several are alternative routes, overrides or platform settings.

## Build-time settings

Supply these before `next build` if using them. Public settings are compiled into their direct references, even when the reference is in server code. Rewrites are also generated at build time for this standalone deployment. Runtime container settings cannot replace these compiled values or rewrite destinations.

| Variable | Purpose, defaults and requirement | Source under `apps/panels` |
|---|---|---|
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | Auth API base and fallback rewrite origin. Shared browser client defaults to `/api`, honors relative overrides, and converts absolute settings to `/api` in the browser. Non-browser contexts retain absolute values. Optional when default proxy routing works. | `lib/api-client.ts:48`, `next.config.js:111` |
| `NEXT_PUBLIC_STOCKS_SERVICE_URL` | Stocks API base, fallback rewrite origin, company-details requests and direct invoice downloads. Shared browser client defaults to `/api`, but the latter two callers use this setting directly and have incompatible path expectations; see below. | `lib/api-client.ts:55`, `hooks/use-company-details.ts:4`, `app/(accounting)/accounting/invoices/page.tsx:226`, `next.config.js:112` |
| `NEXT_PUBLIC_TICKETING_SERVICE_URL` | Ticket client base and fallback rewrite origin. All three ticket clients use `/api` in the browser regardless of this setting. Outside the browser, absolute values have `/api` appended unless already present; empty values remain `/api`. | `lib/ticketing-api.ts:22`, `lib/support-tickets-api.ts:22`, `lib/admin-tickets-api.ts:34`, `next.config.js:113` |
| `NEXT_PUBLIC_STORAGE_SERVICE_URL` | Fallback destination for upload/storage rewrites only. Not a browser upload-client setting. Private STORAGE_SERVICE_URL takes precedence. | `next.config.js:114` |
| `NEXT_PUBLIC_PANELS_URL` | Optional public Panels origin used for storage authentication redirects when request host headers cannot supply a suitable origin. Takes precedence over runtime PANELS_URL. Although read only in a server route, its direct public-variable reference is build configuration. Prefer PANELS_URL if runtime configuration is wanted. | `app/storage/[...path]/route.ts:151` |
| `AUTH_SERVICE_URL` | Private auth rewrite origin. Default: `http://auth-service:3002` in production without VERCEL, otherwise `http://127.0.0.1:3002`. Not read by application runtime handlers. | `next.config.js:111` |
| `STOCKS_SERVICE_URL` | Private stocks/catch-all rewrite origin. Default: `http://stocks-service:3003` in production without VERCEL, otherwise `http://127.0.0.1:3003`. Not read by application runtime handlers. | `next.config.js:112` |
| `TICKETING_SERVICE_URL` | Private ticket/label rewrite origin. Default: `http://ticketing-service:3001` in production without VERCEL, otherwise `http://127.0.0.1:3001`. | `next.config.js:113` |
| `STORAGE_SERVICE_URL` | Private upload/storage rewrite origin. Default: `http://storage-service:3005` in production without VERCEL, otherwise `http://127.0.0.1:3005`. | `next.config.js:114` |
| `VERCEL` | Platform flag affecting default rewrite hosts. A truthy value disables the production-is-Docker inference. Leave unset in Docker; normally supplied by Vercel. No application runtime reads. | `next.config.js:110` |

For private rewrite origins, use an absolute origin with scheme and port. `cleanOrigin()` strips a terminal `/api` and trailing slash. Each private service variable wins over its corresponding public variable. A nonempty BACKEND_ORIGIN overrides all individual service rewrite destinations.

All five public settings are optional overrides, not secrets. No payment-provider credentials belong in this list.

## Settings used at both build time and runtime

| Variable | Build usage | Runtime usage / configuration |
|---|---|---|
| `BACKEND_ORIGIN` | Selects a gateway for `/api/*`, uploads and `/storage/*` rewrites (`next.config.js:57`). | Storage route adds `<origin>/storage` to its fallback candidates (`app/storage/[...path]/route.ts:98,122`). Optional with working direct defaults. Supply a bare gateway origin without `/api` so both consumers behave consistently. Set during both phases when using the gateway. |
| `NODE_ENV` | Console removal and routing defaults; `next build` uses production when unset. | Production/development behavior, logging and storage fallbacks. Dockerfile sets `production`. Use `production` for staging containers too, not `staging`. |

## Runtime-only application settings

| Variable | Requirement / behavior | Source under `apps/panels` |
|---|---|---|
| `COOKIE_ENCRYPTION_KEY` | Secret used to decrypt encrypted session cookies. Supply the same **64-character hexadecimal AES-256 key** used by the backend issuing those cookies. Required for encrypted-cookie panel authentication; absent/wrong key makes proxy decryption fail and protected panel routes redirect to login. No build-time key is required by the source. | `proxy.ts:167`, `app/storage/[...path]/route.ts:41`; key format in `packages/cookie-crypto/src/index.ts` |
| `MINIO_ENDPOINT` | Preferred storage-proxy base URL, including scheme and port. Optional because hard-coded candidates exist, but configure the intended storage explicitly. | `app/storage/[...path]/route.ts:89` |
| `MINIO_PUBLIC_URL` | Next storage-proxy candidate after MINIO_ENDPOINT. Must be reachable from the Panels server. Optional. | `app/storage/[...path]/route.ts:90` |
| `PANELS_URL` | Optional public Panels origin for storage login redirects, after usable forwarded/host headers and NEXT_PUBLIC_PANELS_URL. Production default: `https://panels.unlistedstox.com`. Useful for a runtime-configurable staging domain. | `app/storage/[...path]/route.ts:151` |

The encryption key is not validated at startup by Panels. The storage route has a separate missing-key branch that accepts a three-segment cookie without decryption; despite its development comment, that branch is not restricted by NODE_ENV. Set the correct key in production. This is a source finding, not a claim that the storage route validates a session against the backend.

Storage fallback order begins with MINIO_ENDPOINT and MINIO_PUBLIC_URL. Production then tries the local MinIO host at `http://192.168.1.6:9000`, the configured/default gateway, and other Docker/local hosts. A previously successful candidate is prioritized on later requests. Setting BACKEND_ORIGIN alone does not make it the first storage candidate.

## Additional deployment/tooling settings

These five are configured outside direct application environment reads.

| Variable | Phase | Existing value / role |
|---|---|---|
| `PORT` | Runtime | Dockerfile sets `4000` for the standalone server. Staging Compose maps `4000:4000`. The package's `dev` and `start` scripts explicitly use `--port 4000`, so those CLI paths differ from standalone server PORT configuration. |
| `HOSTNAME` | Runtime | Dockerfile sets `0.0.0.0` for standalone server binding. |
| `NEXT_TELEMETRY_DISABLED` | Build + runtime | Dockerfile sets `1` in both stages. |
| `NODE_OPTIONS` | Runtime in current Compose | Staging Panels service sets `--dns-result-order=ipv4first`; general Node process option. |
| `npm_config_store_dir` | Build tooling | Dockerfile sets `/pnpm/store` for package caching. No application runtime need. |

Sources: `apps/panels/Dockerfile:16,39,51-53,73-75`, `apps/panels/package.json:7-10`, `docker-compose.staging.yml:329-343`.

## Deployment issues found

1. **The Panels Dockerfile declares no build ARG inputs.** It runs `npx turbo run build --filter=panels`, but currently has no plumbing for externally supplied public settings, BACKEND_ORIGIN or private service origins. Arbitrary `--build-arg` names alone will not fix this; the Dockerfile must consume them.
2. **The Compose env_file is runtime-only.** `docker-compose.staging.yml:337-343` supplies `apps/panels/.env`, BACKEND_ORIGIN and MinIO settings to the running container. `.dockerignore` excludes nested `.env*` files. Those settings therefore do not enter the image build through either mechanism. With the current Dockerfile, absent build routing overrides lead to the Docker service defaults, even if a gateway is supplied later at runtime.
3. **Turbo must account for private build settings.** `turbo.json` explicitly lists BACKEND_ORIGIN, COOKIE_ENCRYPTION_KEY and REVALIDATION_SECRET globally. Framework inference covers Next.js NEXT_PUBLIC_* settings. If configuring individual service origins, add AUTH_SERVICE_URL, STOCKS_SERVICE_URL, TICKETING_SERVICE_URL and STORAGE_SERVICE_URL to task `env`/`globalEnv` so strict-mode execution and build cache hashing account for them. Account for VERCEL when targeting that platform. COOKIE_ENCRYPTION_KEY's presence in globalEnv does not create a build requirement.
4. **NEXT_PUBLIC_STOCKS_SERVICE_URL has conflicting path assumptions.** `use-company-details.ts` appends `/stocks/company/<cin>/details`, while the invoice page appends `/api/orders/<id>/invoice`. Thus setting `/api` gives the company hook `/api/stocks/...` but the invoice page `/api/api/orders/...`. A bare origin gives the invoice its expected `/api/orders/...`, but the company hook omits `/api`. Their defaults also differ (`127.0.0.1:3003` versus `localhost:3001`) and refer to the user's machine when called in a browser. A single setting cannot fix both path conventions for a standard `/api` backend; the callers need normalization.
5. **Public and private Panels origins are alternatives.** Once NEXT_PUBLIC_PANELS_URL has been compiled with a nonempty value, changing PANELS_URL at runtime will not override it. Valid request host headers take precedence over both.

## Copyable phase lists

These are variable-name inventories, not instructions to populate every optional override.

Build phase (include selected settings before `next build`):

```text
NEXT_PUBLIC_AUTH_SERVICE_URL
NEXT_PUBLIC_STOCKS_SERVICE_URL
NEXT_PUBLIC_TICKETING_SERVICE_URL
NEXT_PUBLIC_STORAGE_SERVICE_URL
NEXT_PUBLIC_PANELS_URL
AUTH_SERVICE_URL
STOCKS_SERVICE_URL
TICKETING_SERVICE_URL
STORAGE_SERVICE_URL
BACKEND_ORIGIN
NODE_ENV
VERCEL
NEXT_TELEMETRY_DISABLED
npm_config_store_dir
```

Runtime phase (selected settings plus the existing container defaults):

```text
COOKIE_ENCRYPTION_KEY
MINIO_ENDPOINT
MINIO_PUBLIC_URL
PANELS_URL
BACKEND_ORIGIN
NODE_ENV
PORT
HOSTNAME
NEXT_TELEMETRY_DISABLED
NODE_OPTIONS
```

For the current gateway deployment, the main application choices are BACKEND_ORIGIN at build and runtime, public client overrides only where needed, and COOKIE_ENCRYPTION_KEY plus the intended storage endpoints at runtime. PANELS_URL is an optional runtime origin override. Docker/Turbo build plumbing must be added before externally provided build settings can take effect.

No Panels reads were found for REVALIDATION_SECRET, DATABASE_URL, JWT_SECRET, NETCORE_API_KEY, GTM_ID, NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SESSION_COOKIE_NAME, payment-service URL variables or payment-provider secret keys. Root configuration and installed dependencies alone do not make these Panels requirements. Cookie names come from shared constants.

Validation: complete file-content scan for direct/indirect environment access, inspection of actual consumers and relevant shared code, and inventory-to-report coverage check. No application/deployment configuration was changed; no production build or backend calls were performed.

Framework references: [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables), [Turborepo environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).
