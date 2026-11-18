# SMC Unlisted Stocks - Panels (Staff Portals)

This is a Next.js app that hosts **staff portals**. The end-user product lives in `apps/web`.

## Scope

- `apps/panels`: staff workspaces (Admin/CMS/Support/Marketing)
- `apps/web`: end-user web app

## Tech Stack

- **Framework:** Next.js (App Router)
- **UI Library:** React
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Zustand (in-memory)
- **Server State:** TanStack Query v5
- **HTTP Client:** Axios (cookie-based requests via `withCredentials`)
- **Auth Model:** Cookie-only (HttpOnly) sessions
- **Route Protection:** Next.js Middleware (cookie-only validation)

## Prerequisites

- Node.js >= 18
- pnpm 9+
- Backend services running:
  - auth-service on port 3002
  - stocks-service on port 3003
  - ticketing-service on port 3001

## Environment

Create `apps/panels/.env.local` using `apps/panels/.env.local.example` as a reference.

Common values for local dev:

- `NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3002/api`
- `NEXT_PUBLIC_STOCKS_SERVICE_URL=http://localhost:3003/api`
- `NEXT_PUBLIC_TICKETING_SERVICE_URL=http://localhost:3001/api`

## Run Locally

1. Install deps (from repo root):
   - `pnpm install`

2. Start the panels dev server:
   - `cd apps/panels`
   - `pnpm dev`

3. Open:
   - http://localhost:4000

## Authentication (Cookie-Only)

Panels uses **cookie-only** sessions. The frontend does not persist JWTs in browser storage and does not rely on `Authorization: Bearer ...` from the browser.

### Portal routes and cookies

These routes are protected by middleware and a dedicated HttpOnly cookie (names are
obfuscated — see `OBFUSCATED_COOKIE_NAMES` in `packages/cookie-crypto`):

- `/admin/*` (cookie: `OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN`)
- `/cms/*` (cookie: `OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN`)
- `/support/*` (cookie: `OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN`)
- `/marketing/*` (cookie: `OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN`)

### Session verification endpoints

The frontend verifies staff sessions via backend endpoints like:

- `GET /auth/admin/verify`
- `GET /auth/cms/verify`
- `GET /auth/support/verify`
- `GET /auth/marketing/verify`

## Deploy

Deploy as a standard Next.js app (Vercel or equivalent).