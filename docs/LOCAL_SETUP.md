# Local Setup Guide — SMC Unlisted Stox

A step-by-step walkthrough to get **SMC Unlisted Stox** running on your machine.

The project is a pnpm/turbo monorepo containing:

- **Backend microservices (NestJS)** — `auth-service`, `stocks-service`, `ticketing-service`, `payments-service`, `storage-service`
- **Frontends (Next.js)** — `web`, `alankit`, `panels`, `rm-distributors`
- **Shared packages** under `packages/`
- **Local infrastructure** — Redis and MinIO (via Docker Compose)

Work through the steps in order. Each step ends with an **Expected result** so you know it worked before moving on.

---

## Checklist

- [ ] Step 1 — Check prerequisites
- [ ] Step 2 — Clone the repository
- [ ] Step 3 — Install dependencies
- [ ] Step 4 — Create your environment file
- [ ] Step 5 — Start Redis and MinIO
- [ ] Step 6 — Prepare the database
- [ ] Step 7 — Start the services
- [ ] Step 8 — Verify the app
- [ ] Step 9 — *(Optional)* Run the full stack with Docker Compose
- [ ] Step 10 — *(Optional)* Run the e-sign worker

---

## Step 1 — Check prerequisites

| Tool | Minimum version | Install |
|------|-----------------|---------|
| Node.js | `>=18` | [nodejs.org](https://nodejs.org/) |
| pnpm | `9.0.0` | `npm install -g pnpm@9` |
| Docker Desktop | latest | [docker.com](https://www.docker.com/) |
| Git | any | [git-scm.com](https://git-scm.com/) |

Verify:

```bash
node --version      # v18.x or higher
pnpm --version      # 9.x.x
docker --version
docker compose version
```

**Expected:** every command prints a version, and `docker compose version` is `v2.20+`.

---

## Step 2 — Clone the repository

```bash
git clone <repo-url>
cd alankit   # repository root
```

**Expected:** you are in the repo root and `package.json`, `pnpm-workspace.yaml`, and `turbo.json` are present.

---

## Step 3 — Install dependencies

Install all workspace dependencies from the root (this covers both `apps/*` and `packages/*`):

```bash
pnpm install
```

**Expected:** the install completes with no errors and a `node_modules/` folder appears at the root.

---

## Step 4 — Create your environment file

Environment files are gitignored (see `.gitignore`). Create `.env` at the repository root.

> **Why `.env` and not `.env.staging`?** Docker Compose auto-loads a file named exactly `.env` for `${...}` interpolation (build args, `environment:` maps, healthchecks). It does **not** auto-load `.env.staging`. See [How Docker Compose loads environment variables](#how-docker-compose-loads-environment-variables) below.

### 4a. Copy the staging env file

There is an existing `.env.staging` in the repo root:

```bash
# Linux/macOS
cp .env.staging .env

# Windows (PowerShell)
Copy-Item .env.staging .env
```

Then open `.env` and replace staging credentials you don't have with local values (or leave optional integrations blank).

### 4b. Generate local secrets (recommended)

Generate a fresh JWT secret and cookie encryption key for local use:

```bash
# JWT secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Cookie encryption key (hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the outputs into `JWT_SECRET` and `COOKIE_ENCRYPTION_KEY` in `.env`.

### 4c. (Alternative) Minimal local `.env`

If you only want the backend APIs with Docker-provided Redis/MinIO, the following minimal `.env` is enough:

```env
# Runtime
NODE_ENV=development

# Service ports
AUTH_SERVICE_PORT=3002
STOCKS_SERVICE_PORT=3003
TICKETING_SERVICE_PORT=3001
PAYMENTS_SERVICE_PORT=3004
STORAGE_SERVICE_PORT=3005

# Databases (Neon / Postgres)
DATABASE_URL=postgresql://...
TICKETING_DATABASE_URL=postgresql://...

# Local Redis (started via docker-compose.yml)
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# Auth / cookies
JWT_SECRET=replace-with-a-64-char-random-string
COOKIE_ENCRYPTION_KEY=replace-with-a-64-char-hex-string
COOKIE_DOMAIN=localhost
SECURE_COOKIES=false

# Email (optional for local dev)
EMAIL_PROVIDER=smtp
EMAIL_MOCK_MODE=true

# Payments (optional)
CASHFREE_ENVIRONMENT=SANDBOX

# Object storage (MinIO, started via docker-compose.yml)
MINIO_ENDPOINT=http://localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Integrations (optional — leave blank if not testing)
DIGITAP_BASE_URL=https://api.digitap.ai
DIGITAP_CLIENT_ID=
DIGITAP_CLIENT_SECRET=
PROBE42_API_KEY=
```

> ⚠️ Never commit `.env` to Git. It is already in `.gitignore`.

### How Docker Compose loads environment variables

Two independent mechanisms are at play, and mixing them up causes most startup errors:

| Mechanism | Reads from | Affects |
|-----------|-----------|---------|
| `env_file:` (service-level) | `.env.staging` | Variables inside the **running container** |
| `${VAR}` interpolation | `.env` (default) or `--env-file <file>` | **Build args**, `environment:` maps, healthcheck commands — anything written as `${...}` |

Consequences:

- `docker compose -f docker-compose.staging.yml up` auto-loads only `.env` for interpolation. It does **not** read `.env.staging` for `${...}` unless you add `--env-file .env.staging`.
- Setting `COMPOSE_ENV_FILES=.env.staging` **inside** `.env` does not work for interpolation — only setting it in the real shell/OS environment does.
- The staging build passes `DATABASE_URL` as a **build arg** for `prisma generate`. If it is empty, the build fails with `PrismaConfigEnvError: Missing required environment variable: DATABASE_URL`.

If you keep a **copy** of `.env.staging`, refresh it whenever the staging file changes:

```bash
cp .env.staging .env
```

> Use **staging** values in `.env` when you run `docker-compose.staging.yml`; use **local/adapted** values when you run services directly with `pnpm dev`.

**Expected:** a `.env` file exists at the repo root and contains `DATABASE_URL`, `JWT_SECRET`, and `COOKIE_ENCRYPTION_KEY`.

---

## Step 5 — Start Redis and MinIO

The root `docker-compose.yml` runs Redis, MinIO, and RedisInsight on a Docker network named `smc-staging-network`.

If the external network does not exist yet, create it once:

```bash
docker network create smc-staging-network
```

Then start the infrastructure:

```bash
docker compose -f docker-compose.staging.yml up --build -d
docker compose ps
```

**Expected:** `docker compose ps` shows `smc-redis`, `smc-minio`, and `smc-redis-insight` running (or healthy). You can also open:

| Service | URL | Notes |
|---------|-----|-------|
| Redis | `localhost:6379` | no password by default (local-dev only) |
| MinIO S3 API | `localhost:9000` | defaults `minioadmin`/`minioadmin` |
| MinIO Console | `localhost:9001` | web UI for buckets |
| RedisInsight | `localhost:5540` | Redis GUI |

---

## Step 6 — Prepare the database

The backend services use Prisma with PostgreSQL (Neon in staging; any Postgres works locally).

### 6a. Generate Prisma clients

```bash
# Shared by auth/stocks/ticketing
pnpm --filter db-unlistedstock generate

# Ticketing has its own Prisma schema
pnpm --filter db-ticketing generate
```

**Expected:** each command completes with "Generated Prisma Client".

### 6b. Apply migrations

Point `DATABASE_URL` / `TICKETING_DATABASE_URL` in `.env` at your database, then run:

```bash
# stocks/auth/ticketing admin database
pnpm --filter db-unlistedstock exec prisma migrate deploy

# ticketing system database
pnpm --filter db-ticketing exec prisma migrate deploy
```

**Expected:** each command reports the migrations applied (or "No pending migrations").

### 6c. Seed data (optional)

```bash
pnpm --filter db-unlistedstock seed
pnpm --filter db-unlistedstock seed:prices
```

**Expected:** seed scripts finish without errors.

---

## Step 7 — Start the services

### 7a. Run everything (recommended)

```bash
pnpm dev
```

This runs `turbo run dev` across the workspace. Each NestJS service starts with `--watch`, and Next.js apps start in dev mode.

**Expected:** Turbo shows all packages started; each backend logs a "listening on port …" message.

### 7b. Or run individual services

Open a terminal per service:

| Service | Command | Port |
|---------|---------|------|
| auth-service | `pnpm --filter auth-service dev` | 3002 |
| stocks-service | `pnpm --filter stocks-service dev` | 3003 |
| ticketing-service | `pnpm --filter ticketing-service dev` | 3001 |
| payments-service | `pnpm --filter payments-service dev` | 3004 |
| storage-service | `pnpm --filter storage-service dev` | 3005 |
| web (Next.js) | `pnpm --filter web dev` | 3000 |
| panels (Next.js) | `pnpm --filter panels dev` | 4000 |
| alankit (Next.js) | `pnpm --filter alankit dev` | 3000 |
| rm-distributors (Next.js) | `pnpm --filter rm-distributors dev` | 8000 |

### 7c. Or run only the backend APIs

```bash
pnpm start:dev
```

This starts `auth-service`, `stocks-service`, `ticketing-service`, `payments-service`, and `storage-service` together.

---

## Step 8 — Verify the app

With the services running, check the health endpoints:

```bash
# Backend
curl http://localhost:3002/api/health       # auth
curl http://localhost:3003/api/health       # stocks
curl http://localhost:3001/api/health       # ticketing
curl http://localhost:3004/api/health       # payments
curl http://localhost:3005/api/health       # storage

# Frontend
curl http://localhost:3000                  # web
```

**Expected:** each backend returns `OK`/HTTP 200, and the Next.js app loads in your browser at `http://localhost:3000`.

✅ **Local setup complete.** The remaining steps are optional.

---

## Step 9 — (Optional) Run the full stack with Docker Compose (staging)

Instead of running each service locally, you can build and run the whole backend stack — Nginx, all services, and the e-sign worker — from `docker-compose.staging.yml`.

### 9a. Build and start the stack

```bash
docker compose -f docker-compose.staging.yml up --build -d
```

This works because Step 4 created `.env` from `.env.staging`, so Compose has every value it needs for `${...}` interpolation — including the `DATABASE_URL` build arg used by `prisma generate`.

### 9b. Manage the stack

```bash
# Status and logs
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs -f esign-worker

# Stop and clean up
docker compose -f docker-compose.staging.yml down
```

> Building needs `DATABASE_URL` (passed as a build arg to `prisma generate`). If you see `PrismaConfigEnvError: Missing required environment variable: DATABASE_URL`, your `.env` is missing or empty — create it from `.env.staging` (Step 4).

**Expected:** `docker compose ... ps` shows the services running and `docker compose ... logs` shows healthy startup.

---

## Step 10 — (Optional) Run the e-sign worker

In local dev, the stocks-service includes a separate e-sign worker process:

```bash
# Dev mode (watch)
pnpm --filter stocks-service dev:esign-worker

# Compiled mode
pnpm --filter stocks-service build
pnpm --filter stocks-service start:esign-worker
```

It consumes `digitap-esign` jobs from Redis and requires the same Redis + database config as the stocks API. See `docs/esign-worker.md` for details.

**Expected:** the worker starts and logs that it is listening for jobs on the `digitap-esign` queue.

---

## Common commands

| Task | Command |
|------|---------|
| Build all apps | `pnpm build` |
| Lint all apps | `pnpm lint` |
| Type-check all apps | `pnpm check-types` |
| Format code | `pnpm format` |
| View Docker logs | `docker compose logs -f` |
| Stop infrastructure | `docker compose down` |
| Rebuild a service image | `docker compose build <service>` |

---

## Troubleshooting

| Problem | Likely cause / fix |
|---------|--------------------|
| `pnpm install` fails | Ensure Node `>=18` and pnpm `9`. Try `pnpm install --no-frozen-lockfile`. |
| Redis connection refused | Make sure `docker compose up -d` ran and Redis is healthy (`docker compose ps`). |
| Prisma client missing | Run `pnpm --filter db-unlistedstock generate`. |
| Port already in use | Another process is using 3000–3005. Change ports in `.env` or stop the conflicting process. |
| Docker network error | Create the network: `docker network create smc-staging-network`. |
| Build fails: `PrismaConfigEnvError: Missing required environment variable: DATABASE_URL` | No `.env` exists, so the `DATABASE_URL` build arg was empty. Create `.env` from `.env.staging` (Step 4), then rerun `docker compose -f docker-compose.staging.yml up --build -d`. |
| Warnings: `The "X" variable is not set. Defaulting to a blank string` | Same root cause — Compose interpolation has no `.env`. Create `.env` from `.env.staging` (Step 4). |
| `.env.staging` is not picked up automatically | Compose only auto-loads `.env` for `${...}` interpolation; `env_file:` only affects containers. Copy `.env.staging` to `.env` (Step 4). |
| `mem_limit` invalid size error | Ensure `ESIGN_WORKER_MEMORY` has a value (e.g. `768m`) or use `${ESIGN_WORKER_MEMORY:-768m}` in the Compose file. |

---

## Related docs

- `docs/ENVIRONMENT_SETUP.md` — full staging environment variable reference
- `docs/STAGING_DEPLOYMENT_GUIDE.md` — deploying to staging EC2
- `docs/MONOREPO_DOCKER_GUIDE.md` — Docker guidance for the monorepo
- `docs/esign-worker.md` — e-sign worker operation
- `apps/stocks-service/test/E2E_TEST_GUIDE.md` — e2e testing
