# CI/CD Plan — smc-unlisted-stox (Staging on VPN-only server)

> Status: AGREED PLAN (from grill rounds Q1–Q14). Staging is the main env. `develop → staging auto-deploy`. `main → CI only`.
> Constraint: server reachable only via FortiClient VPN. GitHub-hosted runners **cannot** SSH in.

## 1. Agreed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | CI platform | GitHub Actions |
| 2 | Env mapping | `develop` → staging deploy. `main` / PRs → checks only |
| 3 | VPN traversal | Push to GHCR from hosted runners + **lightweight self-hosted runner on the server** (outbound-only, VPN-safe). No inbound SSH |
| 4 | Artifact strategy | CI builds + pushes to GHCR. Server only pulls |
| 5 | Frontend fate | In scope: all 8 images from `docker-compose.staging.yml` (auth, stocks, ticketing, payments, storage, web:3000, panels:4000, rm-distributors:8000). nginx stays `fabiocicerchia/nginx-lua:1.25.3-alpine` + mounted `nginx.conf` |
| 6 | Quality gates | `pnpm install → turbo lint + check-types + build` required before push |
| 7 | Secrets | Real `.env` lives on server, never committed. CI only holds registry creds + non-secret `NEXT_PUBLIC_*` build-args |
| 8 | Runner | Self-hosted `linux,X64` with labels `self-hosted,staging` on the staging box |
| 9 | Tagging | Push both `ghcr.io/<org>/<svc>:sha-<shortsha>` (immutable) + `:staging` (moving). Manual rollback via `TAG=sha-xxx compose up` |
| 10 | Compose | New `docker-compose.deploy.yml` (pull-only, no `build:`). Keep `docker-compose.staging.yml` for local build flow |
| 12 | Migrations | Server-side `prisma migrate deploy` before `compose up`. Never from hosted runner |
| 13 | Registry auth | CI push via `GITHUB_TOKEN` (`packages: write`). Server pull via read-only `GHCR_PULL_TOKEN` in `~/.docker/config.json` |
| 14 | Prod | Not now. Design leaves `TAG` + env plumbing ready for prod later |

## 2. Architecture

```
develop push
  │
  ├─ [ubuntu-latest] ci.yml: pnpm i + turbo lint/check-types/build
  │
  ├─ [ubuntu-latest] build-push.yml: docker buildx × 8 → GHCR (:sha-xxx + :staging)
  │
  └─ [self-hosted,staging] deploy-staging.yml (trigger: workflow_run success):
        docker login ghcr.io
      → prisma migrate deploy (all DB packages)
      → TAG=sha-xxx docker compose -f docker-compose.deploy.yml pull
      → TAG=sha-xxx docker compose -f docker-compose.deploy.yml up -d
      → health-gate: nginx :80/health, :90/health, backends /api/health
```

Why this works through FortiClient: hosted jobs only talk to `ghcr.io` (outbound). Only the self-hosted runner (already inside VPN) touches the server / DB. No port-forwarding, no VPN client in CI.

## 3. Files to create (do not edit existing compose)

### 3.1 `.github/workflows/ci.yml` (hosted, PR + `develop` + `main`)

```yaml
on:
  pull_request:
  push: { branches: [develop, main] }
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.0.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run check-types
      - run: pnpm run build
```

### 3.2 `.github/workflows/build-push.yml` (hosted, `develop` only)

- `permissions: { contents: read, packages: write }`
- Compute `SHORT_SHA=$(git rev-parse --short HEAD)`.
- `docker/login-action` with `GITHUB_TOKEN` → `ghcr.io`.
- `docker/setup-buildx-action` + `docker/build-push-action` per service (matrix of 8):
  - `auth-service` ← `apps/auth-service/Dockerfile`, build-arg `DATABASE_URL=dummy-for-prisma-generate` (real value only used at runtime; see §6)
  - `stocks-service`, `ticketing-service` (+ `TICKETING_DATABASE_URL` dummy), `payments-service`, `storage-service` (no DB arg), `web` (`NEXT_PUBLIC_GTM_ID`), `panels`, `rm-distributors`
  - `context: .`, `push: true`, `tags: ghcr.io/unlistedstox/<svc>:sha-<sha>,ghcr.io/unlistedstox/<svc>:staging`, `cache-from/to: type=gha`
- Emit `SHA` as output / artifact for deploy job.

> Org name: lower-case `unlistedstox` (GHCR requires lowercase). Confirm org/repo owner before first push.

### 3.3 `.github/workflows/deploy-staging.yml` (self-hosted)

```yaml
on:
  workflow_run:
    workflows: [build-push]
    types: [completed]
    branches: [develop]
jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: [self-hosted, staging]
    steps:
      - uses: actions/checkout@v4
        with: { ref: develop }
      # TAG = sha of the triggering commit (pass via workflow_run head_sha)
      - run: echo "TAG=sha-${SHA}" >> $GITHUB_ENV
      - run: ./scripts/deploy-staging.sh  # migrate + pull + up + healthcheck
```

Alternative simpler trigger: `push: branches: [develop]` directly on the self-hosted workflow (runner picks it up via outbound poll). Prefer `workflow_run` to guarantee images exist first.

### 3.4 `docker-compose.deploy.yml` (new, pull-only)

Copy of `docker-compose.staging.yml` with every `build:` block replaced by:

```yaml
auth-service:
  image: ghcr.io/unlistedstox/auth-service:${TAG:-staging}
  # … keep container_name, env_file, environment, depends_on, networks, healthcheck, mem_limit
```

Same for stocks, ticketing, payments, storage, web, panels, rm-distributors. Keep `nginx` (no build) untouched. Keep `staging-network` external.

### 3.5 `scripts/deploy-staging.sh` (runs on server via runner)

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${TAG:?TAG=sha-xxx required}"
docker login ghcr.io -u <bot-user> -p "$GHCR_PULL_TOKEN"  # or pre-logged in
docker network inspect smc-staging-network >/dev/null 2>&1 || docker network create smc-staging-network

# 1. Migrations (server-side, has DB network access)
# run per Prisma package that has migrations, e.g.:
# docker run --rm --network smc-staging-network --env-file .env ghcr.io/unlistedstox/stocks-service:$TAG pnpm --filter db-unlistedstock exec prisma migrate deploy
# repeat for ticketing DB package

# 2. Pull + up
TAG=$TAG docker compose -f docker-compose.deploy.yml pull
TAG=$TAG docker compose -f docker-compose.deploy.yml up -d --remove-orphans

# 3. Health gates (fail = workflow red, manual rollback)
curl -sf http://127.0.0.1:80/health
curl -sf http://127.0.0.1:3002/api/health
curl -sf http://127.0.0.1:3003/api/health
curl -sf http://127.0.0.1:3001/api/health
curl -sf http://127.0.0.1:3004/api/health
curl -sf http://127.0.0.1:3005/api/health

# 4. Cleanup
docker image prune -af --filter "until=168h" || true
```

## 4. Secrets

| Where | Key | Value / source |
|-------|-----|----------------|
| GitHub repo → Actions secrets | `GHCR_PULL_TOKEN` (optional, only if deploy job needs login) | Fine-grained PAT, `read:packages` only, expiry 90d |
| GitHub → push job | `GITHUB_TOKEN` (automatic) | Needs `packages: write` permission |
| Server `~/.docker/config.json` | `ghcr.io` auth | `docker login ghcr.io -u <bot> -p $GHCR_PULL_TOKEN` once |
| Server `/opt/smc/.env` (or repo root `.env`, never committed) | All runtime secrets | Copy from `.env.staging.example`: `JWT_SECRET, COOKIE_SECRET, COOKIE_ENCRYPTION_KEY, DATABASE_URL, TICKETING_DATABASE_URL, REDIS_*, TWILIO_*, SMS_GATEWAY_*, GOOGLE_*, SENDGRID_*, CASHFREE_*, MINIO_*`, ports |
| Server `apps/{web,panels,rm-distributors}/.env` | Frontend runtime | `BACKEND_ORIGIN=http://nginx`, `MINIO_*` |
| CI build-args (non-secret) | `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_*` | Repo variables, baked at build time |

Rotation owner: server `.env` edited over SSH-after-VPN by backend lead. CI secrets rotated in GitHub UI.

## 5. Server one-time setup

1. Docker Engine 24+ + Compose v2, `docker network create smc-staging-network`.
2. Checkout repo to `/opt/smc-unlisted-stox`, `git checkout develop`, place `.env` + `apps/*/.env` (chmod 600).
3. `docker login ghcr.io` with read-only token.
4. Install self-hosted runner (as `svc-smc` user, `systemd` service):
   `Settings → Actions → Runners → New self-hosted runner → Linux X64`, labels `staging`, work dir `/_work`.
5. Verify egress: `curl -sI https://ghcr.io` works while FortiClient connected.
6. Test: `TAG=staging docker compose -f docker-compose.deploy.yml pull && up -d`.

## 6. Build-arg gotchas (from current Dockerfiles)

- Backend images take `ARG DATABASE_URL` (+ `TICKETING_DATABASE_URL` for ticketing) **only for `prisma generate`** at build time. Pass a dummy (`postgresql://u:p@localhost:5432/dummy`) in CI — never the real secret. Real URL comes from server `.env` at runtime.
- `network: host` in current compose `build:` is a local-hack for pnpm fetch; drop it in `deploy.yml` (no builds on server) and in CI builders (hosted runners have direct net).
- Frontend `web` takes `ARG NEXT_PUBLIC_GTM_ID`; `panels` / `rm-distributors` currently take none — add `BACKEND_ORIGIN` as build-time `NEXT_PUBLIC_*` only if those apps bake it. Otherwise keep runtime `env_file`.
- All images are `node:22-alpine`, pnpm 9.0.0 — pin in workflows to match.

## 7. Rollback (manual, as requested)

```bash
# list recent:
docker images 'ghcr.io/unlistedstox/*' --format '{{.Repository}}:{{.Tag}} {{.CreatedSince}}' | sort
# roll back:
TAG=sha-<prev_good> docker compose -f docker-compose.deploy.yml up -d
curl -sf http://127.0.0.1:80/health && curl -sf http://127.0.0.1:90/health
```

Keep last 10 SHAs: `prune` filter `until=168h` preserves them under normal push cadence. No auto-rollback (per Q9).

## 8. What `main` does

CI checks only. No deploy workflow watches `main`. When prod is needed later: duplicate `deploy-staging.yml` → `deploy-prod.yml` (labels `[self-hosted, prod]`, `:prod` tags, manual `workflow_dispatch` approval).

## 9. Implementation checklist

- [ ] Lowercase GHCR org confirmed (`unlistedstox`?)
- [ ] Create `GHCR_PULL_TOKEN` (read-only) + `docker login` on server
- [ ] Install + label self-hosted runner, `systemd` enable
- [ ] Write `ci.yml`, `build-push.yml`, `deploy-staging.yml`, `docker-compose.deploy.yml`, `scripts/deploy-staging.sh`
- [ ] Set CI variables for `NEXT_PUBLIC_*`
- [ ] First green run on `develop`: check GHCR packages appear, server pulls, healthchecks pass
- [ ] Document rollback runbook link in README
- [ ] Add `concurrency: group: staging-deploy, cancel-in-progress: false` to avoid overlapping deploys
- [ ] Add GHCR retention (keep 10 SHAs) via `delete-package-versions` action or manual policy

## 10. Open risks

- Server disk: 8 images × ~300MB + build cache. Mitigated by `image prune` in deploy script.
- FortiClient kills egress to `ghcr.io`? Verify step 5 above before merging workflows.
- `DATABASE_URL` dummy must satisfy Prisma generator validation (format only, no connection needed).
- `docker-compose.staging.yml` mem_limits (250m/svc) assume small box — keep identical in `deploy.yml`.
