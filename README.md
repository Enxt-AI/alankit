# Alankit (Unlisted Stox) - Local Development

Monorepo with NestJS backend services and Next.js frontends.

## Services & Ports

| Service | Type | Port |
|---|---|---|
| auth-service | Backend | 3002 |
| stocks-service | Backend | 3003 |
| payments-service | Backend | 3004 |
| storage-service | Backend | 3005 |
| ticketing-service | Backend | 3001 |
| alankit | Frontend | 3000 |
| panels | Frontend | 4000 |
| rm-distributors | Frontend | 8000 |
| nginx (optional gateway) | Proxy | 80 |

## Prerequisites

- Node.js >= 18
- pnpm 9 (`npm i -g pnpm@9`)
- Redis (local or remote)
- PostgreSQL (Neon or local)
- MinIO (optional, for storage-service)

## Environment Setup

Each backend service already has a `.env` file with local defaults. Update database/Redis/secret values as needed:

- `apps/auth-service/.env`
- `apps/payments-service/.env`
- `apps/stocks-service/.env`
- `apps/storage-service/.env`
- `apps/ticketing-service/.env`

Frontends have `.env.local` files for direct backend calls:

- `apps/panels/.env.local`
- `apps/alankit/.env.local`
- `apps/rm-distributors/.env.local`

## Install

```bash
pnpm install
```

## Run Backend Services

In separate terminals:

```bash
cd apps/auth-service && pnpm run start:dev
cd apps/payments-service && pnpm run start:dev
cd apps/stocks-service && pnpm run start:dev
cd apps/storage-service && pnpm run start:dev
cd apps/ticketing-service && pnpm run start:dev
```

## Run Frontends

```bash
cd apps/alankit && pnpm run dev
cd apps/panels && pnpm run dev
cd apps/rm-distributors && pnpm run dev
```

## Optional: Redis/MinIO via Docker

```bash
docker compose up -d redis minio
```

## Optional: Nginx Gateway

Nginx is optional for local dev because frontends call backend services directly. To use it:

```bash
nginx -c $(pwd)/nginx.conf
```

## Notes

- Frontends call backend services directly using `NEXT_PUBLIC_*_SERVICE_URL`.
- Backend services expose APIs under `/api`.
- CORS is configured for `localhost:3000`, `localhost:4000`, and `localhost:8000`.
- `storage-service` is slated for removal later; MinIO is still used for file storage.
