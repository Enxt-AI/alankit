# SMC Unlisted Stocks - Web (End-User App)

This is the **end-user** Next.js app. Staff portals live in `apps/panels`.

## Scope

- `apps/web`: end-user product (landing, onboarding, dashboard)
- `apps/panels`: staff workspaces (Admin/CMS/Support/Marketing)

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

Create `apps/web/.env.local` using `apps/web/.env.local.example` as a reference.

Common values for local dev:

- `NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3002/api`
- `NEXT_PUBLIC_STOCKS_SERVICE_URL=http://localhost:3003/api`
- `NEXT_PUBLIC_TICKETING_SERVICE_URL=http://localhost:3001/api`

## Run Locally

1. Install deps (from repo root):
   - `pnpm install`

2. Start the web dev server:
   - `cd apps/web`
   - `pnpm dev`

   Optional (Turbopack):
   - `pnpm dev:turbo`

3. Open:
   - http://localhost:3000

## Authentication (Cookie-Only)

Web uses **cookie-only** sessions for end users.

- Backend sets an HttpOnly cookie during sign-in / onboarding (name is obfuscated — see `OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN` in `packages/cookie-crypto`).
- The frontend does not persist user JWTs in browser storage and does not rely on `Authorization: Bearer ...` from the browser.
- On refresh/app load, the frontend hydrates the session via `GET /auth/profile` (cookie required).

## Staff Portals

Staff/admin/CMS/support/marketing portals are intentionally not part of this app. See `apps/panels` (runs on http://localhost:4000).

## Deploy

Deploy as a standard Next.js app (Vercel or equivalent).