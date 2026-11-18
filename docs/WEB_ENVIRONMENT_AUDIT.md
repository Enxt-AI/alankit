# Web service environment-variable audit

Scope: `apps/web`, audited on 2026-10-17. Read/scanned the full contents of all 356 text files (55,748 lines); inventoried 26 binary assets. Excluded `.env*`, dependencies, generated build directories, and TypeScript build caches. No `.env` example or actual secret values were used. Also inspected the web Dockerfile, root Docker ignore rules, Compose configuration, Turbo configuration, and relevant workspace imports. The companion `WEB_ENVIRONMENT_FILE_AUDIT.json` records every file scanned and environment-reference line numbers.

Found **31 application/configuration variables**, plus **4 deployment/tooling variables**. These are supported settings, not 35 mandatory inputs: most have defaults or apply only to specific features.

## Build-time public settings

Supply these before `next build` when overriding their defaults. They do not need to be passed again at runtime for their compiled uses. Setting them only on the running container does not configure the browser bundle. Public values must not contain secrets.

| Variable | Purpose / default | Main source under `apps/web` |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Absolute public website origin. Metadata defaults to `https://www.unlistedstox.com`; also used for payment logo and sitemap generation. Set to the actual deployment origin. | `app/layout.tsx:9`, `components/orders/payment-modal.tsx:80`, `app/sitemap.ts:39` |
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | Auth API base. Browser API client uses `/api` unless a relative override is supplied; server can use an absolute API URL. Also a rewrite/auth-route fallback. | `lib/api-client.ts:74`, `next.config.js:146` |
| `NEXT_PUBLIC_STOCKS_SERVICE_URL` | Stocks API base. Browser API client defaults to `/api`; server accepts an absolute API base. Also used by company routes and static-page helper. | `lib/api-client.ts:75`, `next.config.js:147` |
| `NEXT_PUBLIC_TICKETING_SERVICE_URL` | Ticket API base; main browser client uses `/api`. Ticket attachment page also directly uses this setting. Server falls back to gateway or localhost web port. | `lib/ticketing-api.ts:31`, `app/(user)/dashboard/tickets/[id]/page.tsx:136` |
| `NEXT_PUBLIC_PAYMENTS_SERVICE_URL` | Fallback payment rewrite destination only; private PAYMENTS_SERVICE_URL takes precedence. Not read by the payment client. | `next.config.js:149` |
| `NEXT_PUBLIC_STORAGE_SERVICE_URL` | Fallback storage rewrite destination only; private STORAGE_SERVICE_URL takes precedence. | `next.config.js:150` |
| `NEXT_PUBLIC_STORAGE_API_URL` | Separate browser Demat upload base. Empty means `/api/upload/demat-documents/demat`; accepts an origin or a base ending in `/api`. | `components/demat/link-existing-step.tsx:79` |
| `NEXT_PUBLIC_SESSION_COOKIE_NAME` | Production session cookie name; defaults to `__s_a1`. Development uses `auth_token`. Match backend cookie naming if overriding. | `lib/cookie-constants.ts:5` |
| `NEXT_PUBLIC_GTM_ID` | Optional Google Tag Manager ID. Falls back to server GTM_ID; empty disables GTM. | `app/layout.tsx:98` |
| `NEXT_PUBLIC_CASHFREE_ENVIRONMENT` | Use `production` for production checkout. Backend payment-session environment wins; production-domain detection can also choose production. Otherwise sandbox. | `app/(main)/orders/[orderId]/page.tsx:107`, `app/(main)/payment/esign-success/page.tsx:96` |
| `NEXT_PUBLIC_DIGITAP_ENV` | `production` selects PRODUCTION; otherwise UAT, unless production-domain detection selects PRODUCTION. | `components/orders/payment-modal.tsx:74`, buy-stock/buy-basket clients and disclaimer modal |
| `NEXT_PUBLIC_DEBUG_AUTH` | Optional auth debug logging; enabled only by exact string `true`. Default off. | `hooks/use-session-init.ts:47`, `store/auth-store.ts:201` |

The `NEXT_PUBLIC_*` build rule also applies to direct references in server files such as the sitemap. One exception worth knowing: `static-pages-server.ts` passes `process.env` into an `env` parameter and reads `env.NEXT_PUBLIC_STOCKS_SERVICE_URL`; that indirect access can read the runtime environment. Prefer private STOCKS_SERVICE_URL/BACKEND_ORIGIN there; setting the public variable at runtime still does not update its other compiled uses.

## Private build-time routing settings

These three are read only in `next.config.js` to construct rewrites. Provide at build time if overriding the defaults; the standalone server does not reconstruct rewrites from runtime environment values.

| Variable | Default when production and VERCEL is unset | Other default |
|---|---|---|
| `TICKETING_SERVICE_URL` | `http://ticketing-service:3001` | `http://127.0.0.1:3001` |
| `PAYMENTS_SERVICE_URL` | `http://payments-service:3004` | `http://127.0.0.1:3004` |
| `STORAGE_SERVICE_URL` | `http://storage-service:3005` | `http://127.0.0.1:3005` |

Source: `next.config.js:130-150`. Each private setting takes precedence over the corresponding public service URL. BACKEND_ORIGIN selects gateway rewrites instead of these individual destinations. For private service settings, use bare origins with scheme and port.

## Settings needed at both build time and runtime, when used

| Variable | Why / default | Main source |
|---|---|---|
| `BACKEND_ORIGIN` | Build: gateway rewrites and allowed development hostname. Runtime: API routes, server clients, static pages and storage fallback. Optional if direct defaults work. Use an absolute gateway origin without `/api`. Keep build/runtime values consistent. | `next.config.js:80,128`, `lib/api-client.ts:50`, auth/company/storage routes |
| `AUTH_SERVICE_URL` | Build: auth rewrites and possible server rendering. Runtime: server API-client fallback. Defaults to Docker auth host in production rewrites, local host otherwise; API client itself defaults to `http://auth-service:3002/api`. Use bare origin because API client appends `/api`. | `next.config.js:146`, `lib/api-client.ts:35` |
| `STOCKS_SERVICE_URL` | Build: stocks rewrites and prerendered data. Runtime: server API client and CMS fetches. Defaults to Docker stocks host in production rewrites, local host otherwise; API client defaults to `http://stocks-service:3003/api`. Use bare origin. | `next.config.js:147`, `lib/api-client.ts:36`, `lib/static-pages-server.ts:39` |
| `GTM_ID` | Optional server fallback when NEXT_PUBLIC_GTM_ID is empty. Build value can appear in prerendered HTML; runtime value affects dynamic rendering or regeneration. Runtime-only changes will not immediately update already-generated pages. Prefer NEXT_PUBLIC_GTM_ID at build for consistent behavior. | `app/layout.tsx:98` |
| `NODE_ENV` | Production mode controls compilation, logging, cookies, PWA and service defaults. `next build` selects production when unset; runtime Dockerfile sets `production`. Do not use `staging` as NODE_ENV. | `next.config.js:123,130`, `lib/cookie-constants.ts:4`, `Dockerfile:53` |
| `VERCEL` | Platform flag, not a secret. Truthy value disables the code's production-is-Docker inference. Leave unset for Docker; Vercel normally supplies it. Relevant to build rewrites and runtime CMS/verification routing. | `next.config.js:130`, `lib/static-pages-server.ts:43`, `lib/verification-gate.ts:33` |

These private settings are not universally required: gateway configuration and individual-service configuration are alternatives in the rewrite function. Server helpers have different fallback orders, so the source-specific notes matter.

## Runtime-only application settings

| Variable | Requirement / behavior | Source |
|---|---|---|
| `RESEND_API_KEY` | Required for real contact-form email delivery. Without it, the endpoint logs the submission and returns success without sending email, including in production. Secret: inject at runtime. | `app/api/contact/route.ts:20` |
| `CONTACT_SUPPORT_EMAIL` | Optional contact email recipient; defaults to `support@unlistedstox.com`. | `app/api/contact/route.ts:40` |
| `RESEND_FROM_EMAIL` | Preferred contact sender; use a sender supported by the configured Resend account. | `app/api/contact/route.ts:42` |
| `EMAIL_FROM` | Sender fallback when RESEND_FROM_EMAIL is empty. Final default is `Unlistedstox <no-reply@unlistedstox.com>`. No need to set both sender variables. | `app/api/contact/route.ts:43` |
| `REVALIDATION_SECRET` | Required to use authenticated `/api/revalidate`. Missing value rejects requests with 401. Match the calling backend's value. Secret: inject at runtime; Turbo listing it does not make it a build requirement. | `app/api/revalidate/route.ts:41` |
| `MINIO_ENDPOINT` | Preferred storage-proxy base URL, including scheme and port. Optional because hard-coded fallback candidates exist; set explicitly for the intended environment. | `app/storage/[...path]/route.ts:19` |
| `MINIO_PUBLIC_URL` | Next storage-proxy candidate after MINIO_ENDPOINT; must be reachable from the web server. Optional. | `app/storage/[...path]/route.ts:20` |
| `PORT` | Web listening port; Dockerfile supplies `3000`. Also the server ticket-client localhost fallback. Changing it requires matching container port mapping. | `Dockerfile:55`, `lib/ticketing-api.ts:19` |

## Development-only setting

`BACKEND_SESSION_COOKIE_NAME` is read by `lib/cookie-constants.ts:10` only for a server-side development mismatch warning. It does not configure the cookie name and is unnecessary in production.

## Deployment/tooling settings (additional to the 33 above)

| Variable | Phase | Current configuration |
|---|---|---|
| `HOSTNAME` | Runtime | Dockerfile sets `0.0.0.0` for standalone server binding. |
| `NEXT_TELEMETRY_DISABLED` | Build + runtime | Dockerfile sets `1` in both stages. |
| `NODE_OPTIONS` | Runtime in current Compose | Staging web service sets `--dns-result-order=ipv4first`. General Node setting; no direct application read. |
| `npm_config_store_dir` | Build tooling | Dockerfile sets `/pnpm/store` for package cache configuration. No application runtime need. |

## Current deployment gaps

1. `apps/web/Dockerfile:39` declares only **NEXT_PUBLIC_GTM_ID** as a configurable build argument. The other settings cannot be supplied through arbitrary `--build-arg` values without adding the corresponding Dockerfile plumbing.
2. `.dockerignore` excludes nested `.env*` files. `docker-compose.staging.yml:316` loads `apps/web/.env` into the **running container**, not into the build. Thus that env_file cannot configure browser values or baked rewrite destinations.
3. `turbo.json` globally allows BACKEND_ORIGIN, COOKIE_ENCRYPTION_KEY and REVALIDATION_SECRET. Next.js public variables are covered by Turbo framework inference. Private build inputs such as AUTH_SERVICE_URL, STOCKS_SERVICE_URL, TICKETING_SERVICE_URL, PAYMENTS_SERVICE_URL, STORAGE_SERVICE_URL and GTM_ID are absent from the explicit env configuration. Add used private build inputs to task `env`/`globalEnv` so strict-mode filtering and cache hashing account for them; account for VERCEL too if building for that platform.
4. `COOKIE_ENCRYPTION_KEY` is **not a web-service requirement**. Web imports cookie-name constants from `cookie-crypto/constants`; it does not call encryption/decryption. References in the crypto implementation are documentation examples. Similarly, no web reads of DATABASE_URL, JWT_SECRET, Google OAuth client ID, Cashfree secret keys or Digitap secret keys were found.
5. URL resolution is not uniform: the shared auth/stocks API client prefers an absolute public API base before BACKEND_ORIGIN; the CMS helper prefers private STOCKS_SERVICE_URL; auth profile/signout routes do not read private AUTH_SERVICE_URL. In production without VERCEL, the checkout verification helper always chooses `http://stocks-service:3003`, even if BACKEND_ORIGIN is set. These constraints matter when deploying outside the current Docker network.

## Deployment checklist

- **Build:** set the public settings you need, plus BACKEND_ORIGIN or private service origins for routing. Supply server data origins for pages prerendered during build. Set GTM_ID during build too if using that fallback.
- **Runtime:** pass BACKEND_ORIGIN and/or AUTH_SERVICE_URL/STOCKS_SERVICE_URL where needed, RESEND_API_KEY, REVALIDATION_SECRET, the desired email and storage settings, and GTM_ID if using its fallback. Keep NODE_ENV=production; keep the existing PORT/HOSTNAME defaults unless changing networking.
- Optional flags may remain unset. No runtime secrets need to be added to the public build-variable list.
- First wire the desired build inputs through Dockerfile/Compose and Turbo; supplying them only to the existing runtime env_file is insufficient.

Validation: source/configuration audit, including indirect `env.*` access and workspace imports. No production build or live backend calls were performed. No application/deployment configuration was changed.

Framework references: [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables), [Turborepo environment variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).
