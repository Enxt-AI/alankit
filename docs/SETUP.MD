### 1. Clean Slate (Optional)
If you ever need to completely wipe your local database and start fresh, run this to delete the state:
```powershell
Remove-Item -Recurse -Force .\.state\postgres-data
```

### 2. Boot up the Entire Stack with Docker (Staging / Production)
Make sure Docker is running, then boot the entire unified stack (Backend services + Frontend apps + Databases + NGINX):
```bash
# Create staging network if not already created
docker network create smc-staging-network

# Start all backend services, databases, and frontends (web, panels, rm-distributors)
docker compose up -d redis

docker compose -f docker-compose.staging.yml up --build -d
```

> **Note on Environment Variables in Containers:**
> Ensure `BACKEND_ORIGIN=http://smc-nginx-staging` is set in:
> - `apps/web/.env`
> - `apps/panels/.env`
> - `apps/rm-distributors/.env`
> so containerized Next.js apps route API requests to NGINX internally over Docker's network.

### 2.1 Sync Database Schema (Important)
After the containers are up, if you have new schema changes (or if this is your first time), you **must** sync the database schema. Otherwise, you will encounter `500 Internal Server Errors` (e.g. `The column X does not exist`).

Run these commands on your host machine to push the Prisma schema to the PostgreSQL container:

> **⚠️ WARNING:** Setting `$env:DATABASE_URL` in your PowerShell session will override the `.env` values used by `docker compose`. Be sure to run the cleanup commands below so you don't break your docker network configuration (e.g. causing pgbouncer to fail with `no such database`).

```powershell
# 1. Sync main database
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unlisted_stox_db"
$env:DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unlisted_stox_db"
pnpm --filter db-unlistedstock exec prisma db push

# 2. Sync ticketing database
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketing_system"
$env:DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticketing_system"
pnpm --filter db-ticketing exec prisma db push

# 3. CLEANUP (CRITICAL)
# Clear the environment variables from your shell session
Remove-Item Env:\DATABASE_URL
Remove-Item Env:\DIRECT_DATABASE_URL
```

---

### 3. Local Development Setup (Running outside Docker)

#### Install Monorepo Dependencies
```powershell
$env:PUPPETEER_SKIP_DOWNLOAD="true"; pnpm install
```

#### Push Schema & Seed Main Database
Point your local Prisma CLI to `localhost:5432` to push schema and seed data:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/unlisted_stox_db"
$env:DIRECT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/unlisted_stox_db"

pnpm --filter db-unlistedstock exec prisma db push

# Seed main database
pnpm --filter db-unlistedstock exec npx ts-node src/seed.ts
```

#### Push Schema & Seed Ticketing Database
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ticketing_system"
$env:DIRECT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ticketing_system"

pnpm --filter db-ticketing exec prisma db push
pnpm --filter db-ticketing exec prisma db seed

# CLEANUP (CRITICAL)
Remove-Item Env:\DATABASE_URL
Remove-Item Env:\DIRECT_DATABASE_URL
```

---

### 4. Running Frontends Locally for Development

When running locally on your host machine (outside Docker), ensure `BACKEND_ORIGIN=http://127.0.0.1` or set the respective service URLs:

**Main Web Application (Port 3000):**
```powershell
pnpm --filter web run dev
```

**Panels Application (Port 4000):**
```powershell
pnpm --filter panels run dev
```

**RM & Distributors Portal (Port 8000):**
```powershell
pnpm --filter rm-distributors run dev
```
