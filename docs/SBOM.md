# Software Bill of Materials (SBOM)

**Project:** Unlisted stocks  
**Version:** Monorepo (private)  
**Generated:** 2026-08-06  
**Format:** Human-readable Markdown (CycloneDX-inspired)  
**License:** UNLICENSED (proprietary)

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Runtime Environment](#2-runtime-environment)
- [3. Monorepo Workspace Map](#3-monorepo-workspace-map)
- [4. Internal (Workspace) Packages](#4-internal-workspace-packages)
- [5. Third-Party Dependencies by Workspace](#5-third-party-dependencies-by-workspace)
- [6. Consolidated Unique Dependency Index](#6-consolidated-unique-dependency-index)
- [7. Infrastructure & Docker Images](#7-infrastructure--docker-images)
- [8. Android TWA Dependencies](#8-android-twa-dependencies)
- [9. Build & Dev Toolchain](#9-build--dev-toolchain)
- [10. Security-Relevant Notes](#10-security-relevant-notes)

---

## 1. Project Overview

Unlisted stocks is a **pnpm + Turborepo monorepo** containing 9 applications and 10 shared packages, serving an unlisted stock trading platform with:

- 2× Next.js frontends (client-facing + admin panels)
- 1× RM Distributors portal (Next.js)
- 5× NestJS backend microservices (auth, stocks, payments, ticketing, storage)
- 1× Android TWA wrapper app
- Shared packages for DB access, email, Redis, crypto, types, UI, and config

---

## 2. Runtime Environment

| Component       | Version                      | Notes                                     |
| --------------- | ---------------------------- | ----------------------------------------- |
| **Node.js**     | `>=18` (current: `v24.11.0`) | Engine requirement in root `package.json` |
| **pnpm**        | `9.0.0`                      | Package manager (`packageManager` field)  |
| **Turborepo**   | `^2.5.8`                     | Monorepo build orchestration              |
| **TypeScript**  | `5.9.2`                      | Root-level; services may pin `^5.7.3`     |
| **Docker Base** | `node:22-alpine`             | Development Dockerfile                    |

---

## 3. Monorepo Workspace Map

```
-unlisted-stocks/
├── apps/
│   ├── auth-service          (NestJS – Fastify)
│   ├── panels                (Next.js 16 – Admin)
│   ├── payments-service      (NestJS – Fastify)
│   ├── rm-distributors       (Next.js 16 – RM Portal)
│   ├── stocks-service        (NestJS – Fastify)
│   ├── storage-service       (NestJS – Fastify)
│   ├── ticketing-service     (NestJS – Fastify)
│   ├── web                   (Next.js 16 – Client PWA)
│   └── android-twa           (Gradle – Android TWA)
├── packages/
│   ├── cookie-crypto         (AES-256-GCM utility)
│   ├── db-ticketing          (Prisma – ticketing DB)
│   ├── db-unlistedstock      (Prisma – main DB)
│   ├── email-service         (Netcore Cloud REST – NestJS injectable)
│   ├── eslint-config         (Shared ESLint presets)
│   ├── redis-service         (ioredis wrapper)
│   ├── shared-types          (Cross-service TS types)
│   ├── stats-types           (Analytics TS types)
│   ├── typescript-config     (Shared tsconfig bases)
│   └── ui                    (Shared React components)
```

---

## 4. Internal (Workspace) Packages

These are first-party packages linked via `workspace:*` or `workspace:^`.

| Package                   | Version | Consumed By                                                              |
| ------------------------- | ------- | ------------------------------------------------------------------------ |
| `cookie-crypto`           | `1.0.0` | auth, payments, stocks, ticketing, storage, web, panels, rm-distributors |
| `db-unlistedstock`        | `1.0.0` | auth, payments, stocks, ticketing                                        |
| `db-ticketing`            | `1.0.0` | ticketing                                                                |
| `email-service`           | `1.0.0` | auth, payments, stocks, ticketing, rm-distributors                       |
| `redis-service`           | `1.0.0` | auth, stocks                                                             |
| `shared-types`            | `1.0.0` | ticketing                                                                |
| `stats-types`             | `1.0.0` | ticketing, web, panels                                                   |
| `@repo/ui`                | `0.0.0` | web, panels                                                              |
| `@repo/eslint-config`     | `0.0.0` | web, panels, ui                                                          |
| `@repo/typescript-config` | `0.0.0` | db-ticketing, db-unlistedstock, email, ui, panels                        |

---

## 5. Third-Party Dependencies by Workspace

### 5.1 Root (`-unlisted-stocks`)

| Dependency   | Version  | Type            | License    |
| ------------ | -------- | --------------- | ---------- |
| `prettier`   | `^3.6.2` | devDependencies | MIT        |
| `turbo`      | `^2.5.8` | devDependencies | MIT        |
| `typescript` | `5.9.2`  | devDependencies | Apache-2.0 |

**pnpm Overrides (enforced globally):**

| Package            | Pinned Version |
| ------------------ | -------------- |
| `@nestjs/common`   | `11.1.8`       |
| `@nestjs/core`     | `11.1.8`       |
| `@nestjs/bull`     | `11.0.4`       |
| `@nestjs/config`   | `4.0.2`        |
| `@nestjs/schedule` | `6.1.1`        |
| `bull`             | `4.16.5`       |
| `reflect-metadata` | `0.2.2`        |

---

### 5.2 `apps/auth-service`

#### Production Dependencies

| Dependency                 | Version   | License      |
| -------------------------- | --------- | ------------ |
| `@fastify/cookie`          | `^11.0.2` | MIT          |
| `@fastify/cors`            | `^11.2.0` | MIT          |
| `@nestjs/axios`            | `^4.0.1`  | MIT          |
| `@nestjs/bull`             | `^11.0.4` | MIT          |
| `@nestjs/common`           | `^11.0.1` | MIT          |
| `@nestjs/config`           | `^4.0.2`  | MIT          |
| `@nestjs/core`             | `^11.0.1` | MIT          |
| `@nestjs/jwt`              | `^11.0.1` | MIT          |
| `@nestjs/passport`         | `^11.0.5` | MIT          |
| `@nestjs/platform-express` | `^11.0.1` | MIT          |
| `@nestjs/platform-fastify` | `^11.1.8` | MIT          |
| `@nestjs/terminus`         | `^11.0.0` | MIT          |
| `@nestjs/throttler`        | `^6.5.0`  | MIT          |
| `axios`                    | `^1.13.2` | MIT          |
| `bcrypt`                   | `^6.0.0`  | MIT          |
| `bull`                     | `4.16.5`  | MIT          |
| `class-transformer`        | `^0.5.1`  | MIT          |
| `class-validator`          | `^0.14.2` | MIT          |
| `fastify-cookie`           | `^5.7.0`  | MIT          |
| `ioredis`                  | `^5.8.2`  | MIT          |
| `passport`                 | `^0.7.0`  | MIT          |
| `passport-jwt`             | `^4.0.1`  | MIT          |
| `reflect-metadata`         | `^0.2.2`  | Artistic-2.0 |
| `rxjs`                     | `^7.8.1`  | Apache-2.0   |
| `twilio`                   | `^5.10.4` | MIT          |

#### Dev Dependencies

| Dependency               | Version    | License    |
| ------------------------ | ---------- | ---------- |
| `@eslint/eslintrc`       | `^3.2.0`   | MIT        |
| `@eslint/js`             | `^9.18.0`  | MIT        |
| `@nestjs/cli`            | `^11.0.0`  | MIT        |
| `@nestjs/schematics`     | `^11.0.0`  | MIT        |
| `@nestjs/testing`        | `^11.0.1`  | MIT        |
| `@types/bcrypt`          | `^6.0.0`   | MIT        |
| `@types/express`         | `^5.0.0`   | MIT        |
| `@types/jest`            | `^30.0.0`  | MIT        |
| `@types/node`            | `^22.15.3` | MIT        |
| `@types/passport-jwt`    | `^4.0.1`   | MIT        |
| `@types/supertest`       | `^6.0.2`   | MIT        |
| `eslint`                 | `^9.18.0`  | MIT        |
| `eslint-config-prettier` | `^10.0.1`  | MIT        |
| `eslint-plugin-prettier` | `^5.2.2`   | MIT        |
| `fastify`                | `^5.6.1`   | MIT        |
| `globals`                | `^16.0.0`  | MIT        |
| `jest`                   | `^30.0.0`  | MIT        |
| `prettier`               | `^3.4.2`   | MIT        |
| `source-map-support`     | `^0.5.21`  | MIT        |
| `supertest`              | `^7.0.0`   | MIT        |
| `ts-jest`                | `^29.2.5`  | MIT        |
| `ts-loader`              | `^9.5.2`   | MIT        |
| `ts-node`                | `^10.9.2`  | MIT        |
| `tsconfig-paths`         | `^4.2.0`   | MIT        |
| `typescript`             | `^5.7.3`   | Apache-2.0 |
| `typescript-eslint`      | `^8.20.0`  | MIT        |

---

### 5.3 `apps/payments-service`

#### Production Dependencies

| Dependency                 | Version   | License      |
| -------------------------- | --------- | ------------ |
| `@fastify/cookie`          | `^11.0.2` | MIT          |
| `@fastify/cors`            | `^11.2.0` | MIT          |
| `@nestjs/bull`             | `^11.0.4` | MIT          |
| `@nestjs/common`           | `11.1.8`  | MIT          |
| `@nestjs/config`           | `^4.0.2`  | MIT          |
| `@nestjs/core`             | `11.1.8`  | MIT          |
| `@nestjs/jwt`              | `^11.0.1` | MIT          |
| `@nestjs/passport`         | `^11.0.5` | MIT          |
| `@nestjs/platform-express` | `^11.0.1` | MIT          |
| `@nestjs/platform-fastify` | `^11.1.8` | MIT          |
| `bull`                     | `^4.16.5` | MIT          |
| `cashfree-pg`              | `^5.1.0`  | MIT          |
| `class-transformer`        | `^0.5.1`  | MIT          |
| `class-validator`          | `^0.14.2` | MIT          |
| `passport`                 | `^0.7.0`  | MIT          |
| `passport-jwt`             | `^4.0.1`  | MIT          |
| `reflect-metadata`         | `^0.2.2`  | Artistic-2.0 |
| `rxjs`                     | `^7.8.1`  | Apache-2.0   |

#### Dev Dependencies

| Dependency               | Version    | License      |
| ------------------------ | ---------- | ------------ |
| `@eslint/eslintrc`       | `^3.2.0`   | MIT          |
| `@eslint/js`             | `^9.18.0`  | MIT          |
| `@nestjs/cli`            | `^11.0.0`  | MIT          |
| `@nestjs/schematics`     | `^11.0.0`  | MIT          |
| `@nestjs/testing`        | `^11.0.1`  | MIT          |
| `@types/bull`            | `^4.10.4`  | MIT          |
| `@types/express`         | `^5.0.0`   | MIT          |
| `@types/jest`            | `^30.0.0`  | MIT          |
| `@types/node`            | `^22.10.7` | MIT          |
| `@types/supertest`       | `^6.0.2`   | MIT          |
| `dotenv`                 | `^17.4.2`  | BSD-2-Clause |
| `eslint`                 | `^9.18.0`  | MIT          |
| `eslint-config-prettier` | `^10.0.1`  | MIT          |
| `eslint-plugin-prettier` | `^5.2.2`   | MIT          |
| `globals`                | `^16.0.0`  | MIT          |
| `jest`                   | `^30.0.0`  | MIT          |
| `prettier`               | `^3.4.2`   | MIT          |
| `source-map-support`     | `^0.5.21`  | MIT          |
| `supertest`              | `^7.0.0`   | MIT          |
| `ts-jest`                | `^29.2.5`  | MIT          |
| `ts-loader`              | `^9.5.2`   | MIT          |
| `ts-node`                | `^10.9.2`  | MIT          |
| `tsconfig-paths`         | `^4.2.0`   | MIT          |
| `typescript`             | `^5.7.3`   | Apache-2.0   |
| `typescript-eslint`      | `^8.20.0`  | MIT          |

---

### 5.4 `apps/stocks-service`

#### Production Dependencies

| Dependency                 | Version     | License      |
| -------------------------- | ----------- | ------------ |
| `@aws-sdk/client-s3`       | `^3.1017.0` | Apache-2.0   |
| `@fastify/cookie`          | `^11.0.2`   | MIT          |
| `@fastify/cors`            | `^11.2.0`   | MIT          |
| `@fastify/multipart`       | `^9.3.0`    | MIT          |
| `@fastify/static`          | `^8.3.0`    | MIT          |
| `@nestjs/bull`             | `^11.0.4`   | MIT          |
| `@nestjs/common`           | `11.1.8`    | MIT          |
| `@nestjs/config`           | `^4.0.2`    | MIT          |
| `@nestjs/core`             | `11.1.8`    | MIT          |
| `@nestjs/jwt`              | `^11.0.1`   | MIT          |
| `@nestjs/mapped-types`     | `^2.1.0`    | MIT          |
| `@nestjs/passport`         | `^11.0.5`   | MIT          |
| `@nestjs/platform-express` | `^11.0.1`   | MIT          |
| `@nestjs/platform-fastify` | `^11.1.8`   | MIT          |
| `@nestjs/schedule`         | `^6.1.1`    | MIT          |
| `@nestjs/swagger`          | `^11.2.6`   | MIT          |
| `@nestjs/terminus`         | `^11.0.0`   | MIT          |
| `@nestjs/throttler`        | `^6.5.0`    | MIT          |
| `@types/multer`            | `^2.0.0`    | MIT          |
| `adm-zip`                  | `^0.5.17`   | MIT          |
| `bcrypt`                   | `^6.0.0`    | MIT          |
| `bull`                     | `^4.16.5`   | MIT          |
| `cashfree-pg`              | `^5.1.0`    | MIT          |
| `class-transformer`        | `^0.5.1`    | MIT          |
| `class-validator`          | `^0.14.2`   | MIT          |
| `fastify`                  | `^5.6.1`    | MIT          |
| `passport`                 | `^0.7.0`    | MIT          |
| `passport-jwt`             | `^4.0.1`    | MIT          |
| `pdf-lib`                  | `^1.17.1`   | MIT          |
| `puppeteer`                | `^25.0.4`   | Apache-2.0   |
| `qrcode`                   | `^1.5.4`    | MIT          |
| `reflect-metadata`         | `^0.2.2`    | Artistic-2.0 |
| `rxjs`                     | `^7.8.1`    | Apache-2.0   |
| `uuid`                     | `^9.0.1`    | MIT          |
| `xmldom`                   | `^0.6.0`    | MIT          |

#### Dev Dependencies

| Dependency               | Version    | License    |
| ------------------------ | ---------- | ---------- |
| `@eslint/eslintrc`       | `^3.2.0`   | MIT        |
| `@eslint/js`             | `^9.18.0`  | MIT        |
| `@nestjs/cli`            | `^11.0.0`  | MIT        |
| `@nestjs/schematics`     | `^11.0.0`  | MIT        |
| `@nestjs/testing`        | `^11.0.1`  | MIT        |
| `@types/adm-zip`         | `^0.5.8`   | MIT        |
| `@types/bcrypt`          | `^6.0.0`   | MIT        |
| `@types/cookie-parser`   | `^1.4.10`  | MIT        |
| `@types/express`         | `^5.0.0`   | MIT        |
| `@types/jest`            | `^30.0.0`  | MIT        |
| `@types/node`            | `^22.10.7` | MIT        |
| `@types/passport-jwt`    | `^4.0.1`   | MIT        |
| `@types/qrcode`          | `^1.5.6`   | MIT        |
| `@types/supertest`       | `^6.0.2`   | MIT        |
| `@types/xmldom`          | `^0.1.34`  | MIT        |
| `eslint`                 | `^9.18.0`  | MIT        |
| `eslint-config-prettier` | `^10.0.1`  | MIT        |
| `eslint-plugin-prettier` | `^5.2.2`   | MIT        |
| `globals`                | `^16.0.0`  | MIT        |
| `jest`                   | `^30.0.0`  | MIT        |
| `prettier`               | `^3.4.2`   | MIT        |
| `source-map-support`     | `^0.5.21`  | MIT        |
| `supertest`              | `^7.0.0`   | MIT        |
| `ts-jest`                | `^29.2.5`  | MIT        |
| `ts-loader`              | `^9.5.2`   | MIT        |
| `ts-node`                | `^10.9.2`  | MIT        |
| `tsconfig-paths`         | `^4.2.0`   | MIT        |
| `typescript`             | `^5.7.3`   | Apache-2.0 |
| `typescript-eslint`      | `^8.20.0`  | MIT        |

---

### 5.5 `apps/ticketing-service`

#### Production Dependencies

| Dependency                 | Version   | License      |
| -------------------------- | --------- | ------------ |
| `@fastify/cookie`          | `^10.0.1` | MIT          |
| `@fastify/cors`            | `^11.2.0` | MIT          |
| `@fastify/multipart`       | `^9.3.0`  | MIT          |
| `@fastify/static`          | `^8.3.0`  | MIT          |
| `@nestjs/bull`             | `^11.0.4` | MIT          |
| `@nestjs/common`           | `11.1.8`  | MIT          |
| `@nestjs/config`           | `^4.0.2`  | MIT          |
| `@nestjs/core`             | `11.1.8`  | MIT          |
| `@nestjs/jwt`              | `^11.0.1` | MIT          |
| `@nestjs/passport`         | `^11.0.5` | MIT          |
| `@nestjs/platform-express` | `^11.0.1` | MIT          |
| `@nestjs/platform-fastify` | `^11.1.8` | MIT          |
| `@nestjs/schedule`         | `^6.1.1`  | MIT          |
| `@nestjs/terminus`         | `^11.0.0` | MIT          |
| `@prisma/client`           | `^6.18.0` | Apache-2.0   |
| `@types/passport-jwt`      | `^4.0.1`  | MIT          |
| `bull`                     | `^4.16.5` | MIT          |
| `class-transformer`        | `^0.5.1`  | MIT          |
| `class-validator`          | `^0.14.2` | MIT          |
| `cron`                     | `^4.4.0`  | MIT          |
| `fastify`                  | `^5.6.1`  | MIT          |
| `passport`                 | `^0.7.0`  | MIT          |
| `passport-jwt`             | `^4.0.1`  | MIT          |
| `reflect-metadata`         | `^0.2.2`  | Artistic-2.0 |
| `rxjs`                     | `^7.8.1`  | Apache-2.0   |

#### Dev Dependencies

| Dependency               | Version    | License    |
| ------------------------ | ---------- | ---------- |
| `@eslint/eslintrc`       | `^3.2.0`   | MIT        |
| `@eslint/js`             | `^9.18.0`  | MIT        |
| `@nestjs/cli`            | `^11.0.0`  | MIT        |
| `@nestjs/schematics`     | `^11.0.0`  | MIT        |
| `@nestjs/testing`        | `^11.0.1`  | MIT        |
| `@types/express`         | `^5.0.0`   | MIT        |
| `@types/jest`            | `^30.0.0`  | MIT        |
| `@types/node`            | `^22.15.3` | MIT        |
| `@types/supertest`       | `^6.0.2`   | MIT        |
| `eslint`                 | `^9.18.0`  | MIT        |
| `eslint-config-prettier` | `^10.0.1`  | MIT        |
| `eslint-plugin-prettier` | `^5.2.2`   | MIT        |
| `globals`                | `^16.0.0`  | MIT        |
| `jest`                   | `^30.0.0`  | MIT        |
| `prettier`               | `^3.4.2`   | MIT        |
| `prisma`                 | `^6.17.1`  | Apache-2.0 |
| `source-map-support`     | `^0.5.21`  | MIT        |
| `supertest`              | `^7.0.0`   | MIT        |
| `ts-jest`                | `^29.2.5`  | MIT        |
| `ts-loader`              | `^9.5.2`   | MIT        |
| `ts-node`                | `^10.9.2`  | MIT        |
| `tsconfig-paths`         | `^4.2.0`   | MIT        |
| `typescript`             | `^5.7.3`   | Apache-2.0 |
| `typescript-eslint`      | `^8.20.0`  | MIT        |

---

### 5.6 `apps/storage-service`

#### Production Dependencies

| Dependency                 | Version     | License      |
| -------------------------- | ----------- | ------------ |
| `@aws-sdk/client-s3`       | `^3.1017.0` | Apache-2.0   |
| `@fastify/cookie`          | `^11.0.2`   | MIT          |
| `@fastify/cors`            | `^11.2.0`   | MIT          |
| `@fastify/multipart`       | `^9.3.0`    | MIT          |
| `@nestjs/common`           | `^11.0.1`   | MIT          |
| `@nestjs/config`           | `^4.0.2`    | MIT          |
| `@nestjs/core`             | `^11.0.1`   | MIT          |
| `@nestjs/jwt`              | `^11.0.1`   | MIT          |
| `@nestjs/passport`         | `^11.0.5`   | MIT          |
| `@nestjs/platform-express` | `^11.0.1`   | MIT          |
| `@nestjs/platform-fastify` | `^11.1.8`   | MIT          |
| `passport`                 | `^0.7.0`    | MIT          |
| `passport-jwt`             | `^4.0.1`    | MIT          |
| `reflect-metadata`         | `^0.2.2`    | Artistic-2.0 |
| `rxjs`                     | `^7.8.1`    | Apache-2.0   |

#### Dev Dependencies

| Dependency               | Version    | License    |
| ------------------------ | ---------- | ---------- |
| `@eslint/eslintrc`       | `^3.2.0`   | MIT        |
| `@eslint/js`             | `^9.18.0`  | MIT        |
| `@nestjs/cli`            | `^11.0.0`  | MIT        |
| `@nestjs/schematics`     | `^11.0.0`  | MIT        |
| `@nestjs/testing`        | `^11.0.1`  | MIT        |
| `@types/express`         | `^5.0.0`   | MIT        |
| `@types/jest`            | `^30.0.0`  | MIT        |
| `@types/node`            | `^22.10.7` | MIT        |
| `@types/supertest`       | `^6.0.2`   | MIT        |
| `eslint`                 | `^9.18.0`  | MIT        |
| `eslint-config-prettier` | `^10.0.1`  | MIT        |
| `eslint-plugin-prettier` | `^5.2.2`   | MIT        |
| `globals`                | `^16.0.0`  | MIT        |
| `jest`                   | `^30.0.0`  | MIT        |
| `prettier`               | `^3.4.2`   | MIT        |
| `source-map-support`     | `^0.5.21`  | MIT        |
| `supertest`              | `^7.0.0`   | MIT        |
| `ts-jest`                | `^29.2.5`  | MIT        |
| `ts-loader`              | `^9.5.2`   | MIT        |
| `ts-node`                | `^10.9.2`  | MIT        |
| `tsconfig-paths`         | `^4.2.0`   | MIT        |
| `typescript`             | `^5.7.3`   | Apache-2.0 |
| `typescript-eslint`      | `^8.20.0`  | MIT        |

---

### 5.7 `apps/web` (Client PWA)

#### Production Dependencies

| Dependency                      | Version    | License    |
| ------------------------------- | ---------- | ---------- |
| `@cashfreepayments/cashfree-js` | `^1.0.6`   | MIT        |
| `@hookform/resolvers`           | `^5.2.2`   | MIT        |
| `@radix-ui/react-accordion`     | `^1.2.12`  | MIT        |
| `@radix-ui/react-alert-dialog`  | `^1.1.15`  | MIT        |
| `@radix-ui/react-avatar`        | `^1.1.11`  | MIT        |
| `@radix-ui/react-checkbox`      | `^1.3.3`   | MIT        |
| `@radix-ui/react-dialog`        | `^1.1.15`  | MIT        |
| `@radix-ui/react-dropdown-menu` | `^2.1.16`  | MIT        |
| `@radix-ui/react-label`         | `^2.1.8`   | MIT        |
| `@radix-ui/react-popover`       | `^1.1.15`  | MIT        |
| `@radix-ui/react-select`        | `^2.2.6`   | MIT        |
| `@radix-ui/react-separator`     | `^1.1.8`   | MIT        |
| `@radix-ui/react-slider`        | `^1.3.6`   | MIT        |
| `@radix-ui/react-slot`          | `^1.2.4`   | MIT        |
| `@radix-ui/react-tabs`          | `^1.1.13`  | MIT        |
| `@radix-ui/react-toggle`        | `^1.1.10`  | MIT        |
| `@radix-ui/react-toggle-group`  | `^1.1.11`  | MIT        |
| `@radix-ui/react-tooltip`       | `^1.2.8`   | MIT        |
| `@react-oauth/google`           | `^0.12.2`  | MIT        |
| `@tailwindcss/typography`       | `^0.5.19`  | MIT        |
| `@tanstack/react-query`         | `^5.90.7`  | MIT        |
| `@tiptap/extension-link`        | `^3.11.0`  | MIT        |
| `@tiptap/react`                 | `^3.11.0`  | MIT        |
| `@tiptap/starter-kit`           | `^3.11.0`  | MIT        |
| `@types/js-cookie`              | `^3.0.6`   | MIT        |
| `autoprefixer`                  | `^10.4.21` | MIT        |
| `axios`                         | `^1.13.2`  | MIT        |
| `class-variance-authority`      | `^0.7.1`   | Apache-2.0 |
| `clsx`                          | `^2.1.1`   | MIT        |
| `date-fns`                      | `^4.1.0`   | MIT        |
| `embla-carousel-autoplay`       | `^8.6.0`   | MIT        |
| `embla-carousel-react`          | `^8.6.0`   | MIT        |
| `framer-motion`                 | `^12.33.0` | MIT        |
| `input-otp`                     | `^1.4.2`   | MIT        |
| `isomorphic-dompurify`          | `^2.31.0`  | Apache-2.0 |
| `js-cookie`                     | `^3.0.5`   | MIT        |
| `jspdf`                         | `^4.2.1`   | MIT        |
| `jspdf-autotable`               | `^5.0.8`   | MIT        |
| `lucide-react`                  | `^0.553.0` | ISC        |
| `next`                          | `^16.1.4`  | MIT        |
| `next-themes`                   | `^0.4.6`   | MIT        |
| `papaparse`                     | `^5.4.1`   | MIT        |
| `postcss`                       | `^8.5.6`   | MIT        |
| `react`                         | `^19.2.3`  | MIT        |
| `react-day-picker`              | `^8.10.1`  | MIT        |
| `react-dom`                     | `^19.2.3`  | MIT        |
| `react-hook-form`               | `^7.66.0`  | MIT        |
| `react-icons`                   | `^5.5.0`   | MIT        |
| `recharts`                      | `^3.4.1`   | MIT        |
| `tailwind-merge`                | `^3.4.0`   | MIT        |
| `tailwindcss-animate`           | `^1.0.7`   | MIT        |
| `use-debounce`                  | `^10.0.6`  | MIT        |
| `zod`                           | `^4.1.12`  | MIT        |
| `zustand`                       | `^5.0.8`   | MIT        |

#### Dev Dependencies

| Dependency                | Version    | License    |
| ------------------------- | ---------- | ---------- |
| `@tailwindcss/line-clamp` | `^0.4.4`   | MIT        |
| `@types/node`             | `^22.15.3` | MIT        |
| `@types/papaparse`        | `^5.3.14`  | MIT        |
| `@types/react`            | `19.1.0`   | MIT        |
| `@types/react-dom`        | `19.1.1`   | MIT        |
| `eslint`                  | `^9.38.0`  | MIT        |
| `tailwindcss`             | `^3.4.0`   | MIT        |
| `typescript`              | `5.9.2`    | Apache-2.0 |

---

### 5.8 `apps/panels` (Admin Dashboard)

#### Production Dependencies

| Dependency                       | Version    | License    |
| -------------------------------- | ---------- | ---------- |
| `@dnd-kit/core`                  | `^6.3.1`   | MIT        |
| `@dnd-kit/sortable`              | `^10.0.0`  | MIT        |
| `@dnd-kit/utilities`             | `^3.2.2`   | MIT        |
| `@hookform/resolvers`            | `^5.2.2`   | MIT        |
| `@radix-ui/react-accordion`      | `^1.2.12`  | MIT        |
| `@radix-ui/react-alert-dialog`   | `^1.1.15`  | MIT        |
| `@radix-ui/react-avatar`         | `^1.1.11`  | MIT        |
| `@radix-ui/react-checkbox`       | `^1.3.3`   | MIT        |
| `@radix-ui/react-dialog`         | `^1.1.15`  | MIT        |
| `@radix-ui/react-dropdown-menu`  | `^2.1.16`  | MIT        |
| `@radix-ui/react-label`          | `^2.1.8`   | MIT        |
| `@radix-ui/react-popover`        | `^1.1.15`  | MIT        |
| `@radix-ui/react-select`         | `^2.2.6`   | MIT        |
| `@radix-ui/react-separator`      | `^1.1.8`   | MIT        |
| `@radix-ui/react-slider`         | `^1.3.6`   | MIT        |
| `@radix-ui/react-slot`           | `^1.2.4`   | MIT        |
| `@radix-ui/react-switch`         | `^1.3.2`   | MIT        |
| `@radix-ui/react-tabs`           | `^1.1.13`  | MIT        |
| `@radix-ui/react-toast`          | `^1.2.15`  | MIT        |
| `@radix-ui/react-toggle`         | `^1.1.10`  | MIT        |
| `@radix-ui/react-toggle-group`   | `^1.1.11`  | MIT        |
| `@radix-ui/react-tooltip`        | `^1.2.8`   | MIT        |
| `@react-oauth/google`            | `^0.12.2`  | MIT        |
| `@tailwindcss/typography`        | `^0.5.19`  | MIT        |
| `@tanstack/react-query`          | `^5.90.7`  | MIT        |
| `@tiptap/extension-link`         | `^3.11.0`  | MIT        |
| `@tiptap/extension-table`        | `^3.27.1`  | MIT        |
| `@tiptap/extension-table-cell`   | `^3.27.1`  | MIT        |
| `@tiptap/extension-table-header` | `^3.27.1`  | MIT        |
| `@tiptap/extension-table-row`    | `^3.27.1`  | MIT        |
| `@tiptap/react`                  | `^3.11.0`  | MIT        |
| `@tiptap/starter-kit`            | `^3.11.0`  | MIT        |
| `@types/js-cookie`               | `^3.0.6`   | MIT        |
| `autoprefixer`                   | `^10.4.21` | MIT        |
| `axios`                          | `^1.13.2`  | MIT        |
| `canvas-confetti`                | `^1.9.4`   | ISC        |
| `class-variance-authority`       | `^0.7.1`   | Apache-2.0 |
| `clsx`                           | `^2.1.1`   | MIT        |
| `date-fns`                       | `^4.1.0`   | MIT        |
| `embla-carousel-autoplay`        | `^8.6.0`   | MIT        |
| `embla-carousel-react`           | `^8.6.0`   | MIT        |
| `framer-motion`                  | `^12.33.0` | MIT        |
| `input-otp`                      | `^1.4.2`   | MIT        |
| `isomorphic-dompurify`           | `^2.31.0`  | Apache-2.0 |
| `js-cookie`                      | `^3.0.5`   | MIT        |
| `lucide-react`                   | `^0.553.0` | ISC        |
| `next`                           | `^16.1.4`  | MIT        |
| `next-themes`                    | `^0.4.6`   | MIT        |
| `papaparse`                      | `^5.4.1`   | MIT        |
| `postcss`                        | `^8.5.6`   | MIT        |
| `qrcode`                         | `^1.5.4`   | MIT        |
| `react`                          | `^19.2.3`  | MIT        |
| `react-day-picker`               | `^9.14.0`  | MIT        |
| `react-dom`                      | `^19.2.3`  | MIT        |
| `react-hook-form`                | `^7.66.0`  | MIT        |
| `react-icons`                    | `^5.5.0`   | MIT        |
| `recharts`                       | `^3.4.1`   | MIT        |
| `sonner`                         | `^2.0.7`   | MIT        |
| `tailwind-merge`                 | `^3.4.0`   | MIT        |
| `tailwindcss-animate`            | `^1.0.7`   | MIT        |
| `use-debounce`                   | `^10.0.6`  | MIT        |
| `xlsx`                           | `^0.18.5`  | Apache-2.0 |
| `zod`                            | `^4.1.12`  | MIT        |
| `zustand`                        | `^5.0.8`   | MIT        |

#### Dev Dependencies

| Dependency                | Version    | License    |
| ------------------------- | ---------- | ---------- |
| `@tailwindcss/line-clamp` | `^0.4.4`   | MIT        |
| `@types/canvas-confetti`  | `^1.9.0`   | MIT        |
| `@types/node`             | `^22.15.3` | MIT        |
| `@types/papaparse`        | `^5.3.14`  | MIT        |
| `@types/qrcode`           | `^1.5.6`   | MIT        |
| `@types/react`            | `19.1.0`   | MIT        |
| `@types/react-dom`        | `19.1.1`   | MIT        |
| `eslint`                  | `^9.38.0`  | MIT        |
| `tailwindcss`             | `^3.4.0`   | MIT        |
| `typescript`              | `5.9.2`    | Apache-2.0 |

---

### 5.9 `apps/rm-distributors` (RM Portal)

#### Production Dependencies

| Dependency                      | Version    | License    |
| ------------------------------- | ---------- | ---------- |
| `@radix-ui/react-dialog`        | `^1.1.15`  | MIT        |
| `@radix-ui/react-dropdown-menu` | `^2.1.16`  | MIT        |
| `@radix-ui/react-label`         | `^2.1.8`   | MIT        |
| `@radix-ui/react-primitive`     | `^2.1.4`   | MIT        |
| `@radix-ui/react-select`        | `^2.2.6`   | MIT        |
| `@radix-ui/react-separator`     | `^1.1.8`   | MIT        |
| `@radix-ui/react-slot`          | `^1.2.4`   | MIT        |
| `@radix-ui/react-tooltip`       | `^1.2.8`   | MIT        |
| `class-variance-authority`      | `^0.7.1`   | Apache-2.0 |
| `clsx`                          | `^2.1.1`   | MIT        |
| `lucide-react`                  | `^0.553.0` | ISC        |
| `next`                          | `16.2.4`   | MIT        |
| `react`                         | `19.2.4`   | MIT        |
| `react-dom`                     | `19.2.4`   | MIT        |
| `recharts`                      | `^3.4.1`   | MIT        |
| `tailwind-merge`                | `^3.4.0`   | MIT        |
| `tailwindcss-animate`           | `^1.0.7`   | MIT        |
| `xlsx`                          | `^0.18.5`  | Apache-2.0 |
| `zod`                           | `^4.1.12`  | MIT        |

#### Dev Dependencies

| Dependency           | Version    | License    |
| -------------------- | ---------- | ---------- |
| `@types/node`        | `^20`      | MIT        |
| `@types/react`       | `^19`      | MIT        |
| `@types/react-dom`   | `^19`      | MIT        |
| `autoprefixer`       | `^10.4.21` | MIT        |
| `eslint`             | `^9`       | MIT        |
| `eslint-config-next` | `16.2.4`   | MIT        |
| `postcss`            | `^8.5.6`   | MIT        |
| `tailwindcss`        | `3.4.0`    | MIT        |
| `typescript`         | `^5`       | Apache-2.0 |

---

### 5.10 `packages/cookie-crypto`

| Dependency    | Version    | Type | License    |
| ------------- | ---------- | ---- | ---------- |
| `@types/node` | `^22.15.3` | dev  | MIT        |
| `typescript`  | `^5.9.2`   | dev  | Apache-2.0 |

> No third-party runtime dependencies. Uses Node.js built-in `crypto` module (AES-256-GCM).

---

### 5.11 `packages/db-ticketing`

| Dependency       | Version   | Type | License    |
| ---------------- | --------- | ---- | ---------- |
| `@prisma/client` | `^6.18.0` | prod | Apache-2.0 |
| `prisma`         | `^6.17.1` | prod | Apache-2.0 |
| `@types/node`    | `^24.7.2` | dev  | MIT        |

---

### 5.12 `packages/db-unlistedstock`

| Dependency       | Version   | Type | License    |
| ---------------- | --------- | ---- | ---------- |
| `@prisma/client` | `^6.18.0` | prod | Apache-2.0 |
| `bcrypt`         | `^6.0.0`  | prod | MIT        |
| `prisma`         | `^6.18.0` | prod | Apache-2.0 |
| `xlsx`           | `^0.18.5` | prod | Apache-2.0 |
| `@types/bcrypt`  | `^6.0.0`  | dev  | MIT        |
| `@types/node`    | `^24.7.2` | dev  | MIT        |
| `ts-node`        | `^10.9.2` | dev  | MIT        |

---

### 5.13 `packages/email-service`

| Dependency         | Version    | Type | License      |
| ------------------ | ---------- | ---- | ------------ |
| `@nestjs/common`   | `11.1.8`   | prod | MIT          |
| `reflect-metadata` | `0.2.2`    | prod | Artistic-2.0 |
| `rxjs`             | `^7.8.1`   | prod | Apache-2.0   |
| `@types/node`      | `^22.15.3` | dev  | MIT          |
| `typescript`       | `^5.7.3`   | dev  | Apache-2.0   |

**Peer Dependencies:** `@nestjs/common >=11.0.0`

---

### 5.14 `packages/redis-service`

| Dependency    | Version    | Type | License    |
| ------------- | ---------- | ---- | ---------- |
| `ioredis`     | `^5.8.2`   | prod | MIT        |
| `@types/node` | `^24.10.0` | dev  | MIT        |
| `typescript`  | `^5.3.3`   | dev  | Apache-2.0 |

---

### 5.15 `packages/eslint-config`

| Dependency                  | Version   | Type | License    |
| --------------------------- | --------- | ---- | ---------- |
| `@eslint/js`                | `^9.34.0` | dev  | MIT        |
| `@next/eslint-plugin-next`  | `^15.5.0` | dev  | MIT        |
| `eslint`                    | `^9.38.0` | dev  | MIT        |
| `eslint-config-prettier`    | `^10.1.1` | dev  | MIT        |
| `eslint-plugin-only-warn`   | `^1.1.0`  | dev  | MIT        |
| `eslint-plugin-react`       | `^7.37.5` | dev  | MIT        |
| `eslint-plugin-react-hooks` | `^5.2.0`  | dev  | MIT        |
| `eslint-plugin-turbo`       | `^2.5.0`  | dev  | MIT        |
| `globals`                   | `^16.3.0` | dev  | MIT        |
| `typescript`                | `^5.9.2`  | dev  | Apache-2.0 |
| `typescript-eslint`         | `^8.40.0` | dev  | MIT        |

---

### 5.16 `packages/shared-types`

| Dependency   | Version  | Type | License    |
| ------------ | -------- | ---- | ---------- |
| `typescript` | `^5.9.2` | dev  | Apache-2.0 |

> No runtime dependencies. Pure TypeScript type definitions only.

---

### 5.17 `packages/stats-types`

| Dependency   | Version  | Type | License    |
| ------------ | -------- | ---- | ---------- |
| `typescript` | `^5.9.2` | dev  | Apache-2.0 |

> No runtime dependencies. Pure TypeScript type definitions only.

---

### 5.18 `packages/typescript-config`

> No dependencies. Contains only shared `tsconfig.json` base files.

---

### 5.19 `packages/ui`

| Dependency         | Version    | Type | License    |
| ------------------ | ---------- | ---- | ---------- |
| `react`            | `^19.2.0`  | prod | MIT        |
| `react-dom`        | `^19.1.0`  | prod | MIT        |
| `@types/node`      | `^22.15.3` | dev  | MIT        |
| `@types/react`     | `19.1.0`   | dev  | MIT        |
| `@types/react-dom` | `19.1.1`   | dev  | MIT        |
| `eslint`           | `^9.38.0`  | dev  | MIT        |
| `typescript`       | `5.9.2`    | dev  | Apache-2.0 |

---

## 6. Consolidated Unique Dependency Index

A deduplicated list of all unique third-party packages used anywhere in the monorepo (excluding `@types/*` and workspace packages).

| #   | Package                             | Primary Category       | License      |
| --- | ----------------------------------- | ---------------------- | ------------ |
| 1   | `@aws-sdk/client-s3`                | Cloud / Storage        | Apache-2.0   |
| 2   | `@cashfreepayments/cashfree-js`     | Payments               | MIT          |
| 3   | `@dnd-kit/core`                     | UI / Drag & Drop       | MIT          |
| 4   | `@dnd-kit/sortable`                 | UI / Drag & Drop       | MIT          |
| 5   | `@dnd-kit/utilities`                | UI / Drag & Drop       | MIT          |
| 6   | `@eslint/eslintrc`                  | Tooling / Lint         | MIT          |
| 7   | `@eslint/js`                        | Tooling / Lint         | MIT          |
| 8   | `@fastify/cookie`                   | Server / HTTP          | MIT          |
| 9   | `@fastify/cors`                     | Server / HTTP          | MIT          |
| 10  | `@fastify/multipart`                | Server / Upload        | MIT          |
| 11  | `@fastify/static`                   | Server / Static        | MIT          |
| 12  | `@hookform/resolvers`               | UI / Forms             | MIT          |
| 13  | `@nestjs/axios`                     | Server / HTTP Client   | MIT          |
| 14  | `@nestjs/bull`                      | Server / Queue         | MIT          |
| 15  | `@nestjs/cli`                       | Tooling / NestJS       | MIT          |
| 16  | `@nestjs/common`                    | Server / Core          | MIT          |
| 17  | `@nestjs/config`                    | Server / Config        | MIT          |
| 18  | `@nestjs/core`                      | Server / Core          | MIT          |
| 19  | `@nestjs/jwt`                       | Server / Auth          | MIT          |
| 20  | `@nestjs/mapped-types`              | Server / DTO           | MIT          |
| 21  | `@nestjs/passport`                  | Server / Auth          | MIT          |
| 22  | `@nestjs/platform-express`          | Server / HTTP          | MIT          |
| 23  | `@nestjs/platform-fastify`          | Server / HTTP          | MIT          |
| 24  | `@nestjs/schematics`                | Tooling / NestJS       | MIT          |
| 25  | `@nestjs/schedule`                  | Server / Cron          | MIT          |
| 26  | `@nestjs/swagger`                   | Server / Docs          | MIT          |
| 27  | `@nestjs/terminus`                  | Server / Health        | MIT          |
| 28  | `@nestjs/testing`                   | Testing / NestJS       | MIT          |
| 29  | `@nestjs/throttler`                 | Server / Rate Limit    | MIT          |
| 30  | `@next/eslint-plugin-next`          | Tooling / Lint         | MIT          |
| 31  | `@prisma/client`                    | Database / ORM         | Apache-2.0   |
| 32  | `@radix-ui/react-*` (18 pkgs)       | UI / Primitives        | MIT          |
| 33  | `@react-oauth/google`               | Auth / OAuth           | MIT          |
| 34  | `@tailwindcss/line-clamp`           | UI / CSS               | MIT          |
| 35  | `@tailwindcss/typography`           | UI / CSS               | MIT          |
| 36  | `@tanstack/react-query`             | Data Fetching          | MIT          |
| 37  | `@tiptap/extension-link`            | UI / Rich Text         | MIT          |
| 38  | `@tiptap/extension-table*` (4 pkgs) | UI / Rich Text         | MIT          |
| 39  | `@tiptap/react`                     | UI / Rich Text         | MIT          |
| 40  | `@tiptap/starter-kit`               | UI / Rich Text         | MIT          |
| 41  | `adm-zip`                           | Utility / Archive      | MIT          |
| 42  | `autoprefixer`                      | Tooling / CSS          | MIT          |
| 43  | `axios`                             | HTTP Client            | MIT          |
| 44  | `bcrypt`                            | Security / Hashing     | MIT          |
| 45  | `bull`                              | Queue / Redis          | MIT          |
| 46  | `canvas-confetti`                   | UI / Animation         | ISC          |
| 47  | `cashfree-pg`                       | Payments / Gateway     | MIT          |
| 48  | `class-transformer`                 | Server / Serialization | MIT          |
| 49  | `class-validator`                   | Server / Validation    | MIT          |
| 50  | `class-variance-authority`          | UI / Styling           | Apache-2.0   |
| 51  | `clsx`                              | UI / Utility           | MIT          |
| 52  | `cron`                              | Utility / Scheduling   | MIT          |
| 53  | `date-fns`                          | Utility / Dates        | MIT          |
| 54  | `dotenv`                            | Config / Env           | BSD-2-Clause |
| 55  | `embla-carousel-autoplay`           | UI / Carousel          | MIT          |
| 56  | `embla-carousel-react`              | UI / Carousel          | MIT          |
| 57  | `eslint`                            | Tooling / Lint         | MIT          |
| 58  | `eslint-config-next`                | Tooling / Lint         | MIT          |
| 59  | `eslint-config-prettier`            | Tooling / Lint         | MIT          |
| 60  | `eslint-plugin-only-warn`           | Tooling / Lint         | MIT          |
| 61  | `eslint-plugin-prettier`            | Tooling / Lint         | MIT          |
| 62  | `eslint-plugin-react`               | Tooling / Lint         | MIT          |
| 63  | `eslint-plugin-react-hooks`         | Tooling / Lint         | MIT          |
| 64  | `eslint-plugin-turbo`               | Tooling / Lint         | MIT          |
| 65  | `fastify`                           | Server / HTTP          | MIT          |
| 66  | `fastify-cookie`                    | Server / HTTP          | MIT          |
| 67  | `framer-motion`                     | UI / Animation         | MIT          |
| 68  | `globals`                           | Tooling / Lint         | MIT          |
| 69  | `input-otp`                         | UI / OTP Input         | MIT          |
| 70  | `ioredis`                           | Database / Redis       | MIT          |
| 71  | `isomorphic-dompurify`              | Security / XSS         | Apache-2.0   |
| 72  | `jest`                              | Testing                | MIT          |
| 73  | `js-cookie`                         | Utility / Cookies      | MIT          |
| 74  | `jspdf`                             | Utility / PDF          | MIT          |
| 75  | `jspdf-autotable`                   | Utility / PDF          | MIT          |
| 76  | `lucide-react`                      | UI / Icons             | ISC          |
| 77  | `next`                              | Framework / React      | MIT          |
| 78  | `next-themes`                       | UI / Theming           | MIT          |
| 79  | `papaparse`                         | Utility / CSV          | MIT          |
| 80  | `passport`                          | Server / Auth          | MIT          |
| 81  | `passport-jwt`                      | Server / Auth          | MIT          |
| 82  | `pdf-lib`                           | Utility / PDF          | MIT          |
| 83  | `postcss`                           | Tooling / CSS          | MIT          |
| 84  | `prettier`                          | Tooling / Format       | MIT          |
| 85  | `prisma`                            | Database / ORM         | Apache-2.0   |
| 86  | `puppeteer`                         | Automation / Browser   | Apache-2.0   |
| 87  | `qrcode`                            | Utility / QR           | MIT          |
| 88  | `react`                             | Framework / UI         | MIT          |
| 89  | `react-day-picker`                  | UI / Date Picker       | MIT          |
| 90  | `react-dom`                         | Framework / UI         | MIT          |
| 91  | `react-hook-form`                   | UI / Forms             | MIT          |
| 92  | `react-icons`                       | UI / Icons             | MIT          |
| 93  | `recharts`                          | UI / Charts            | MIT          |
| 94  | `reflect-metadata`                  | Runtime / Metadata     | Artistic-2.0 |
| 95  | Netcore Cloud (REST API)            | Email / API            | -            |
| 96  | `rxjs`                              | Utility / Reactive     | Apache-2.0   |
| 97  | `sonner`                            | UI / Toast             | MIT          |
| 98  | `source-map-support`                | Debug / Source Maps    | MIT          |
| 99  | `supertest`                         | Testing / HTTP         | MIT          |
| 100 | `tailwind-merge`                    | UI / Styling           | MIT          |
| 101 | `tailwindcss`                       | Tooling / CSS          | MIT          |
| 102 | `tailwindcss-animate`               | UI / Animation         | MIT          |
| 103 | `ts-jest`                           | Testing / TypeScript   | MIT          |
| 104 | `ts-loader`                         | Tooling / Build        | MIT          |
| 105 | `ts-node`                           | Runtime / TypeScript   | MIT          |
| 106 | `tsconfig-paths`                    | Tooling / Build        | MIT          |
| 107 | `turbo`                             | Tooling / Monorepo     | MIT          |
| 108 | `twilio`                            | Communications / SMS   | MIT          |
| 109 | `typescript`                        | Language / Compiler    | Apache-2.0   |
| 110 | `typescript-eslint`                 | Tooling / Lint         | MIT          |
| 111 | `use-debounce`                      | UI / Utility           | MIT          |
| 112 | `uuid`                              | Utility / ID           | MIT          |
| 113 | `xlsx`                              | Utility / Excel        | Apache-2.0   |
| 114 | `xmldom`                            | Utility / XML          | MIT          |
| 115 | `zod`                               | Validation / Schema    | MIT          |
| 116 | `zustand`                           | State Management       | MIT          |

**Total unique third-party packages: ~116** (excluding `@types/*` type definitions)

---

## 7. Infrastructure & Docker Images

| Image         | Version/Tag                    | Purpose                      | License            |
| ------------- | ------------------------------ | ---------------------------- | ------------------ |
| `node`        | `22-alpine`                    | Dev Dockerfile base          | MIT                |
| `nginx`       | `1.25-alpine`                  | Reverse proxy                | BSD-2-Clause       |
| `redis`       | `7-alpine`                     | Caching & Bull queues        | BSD-3-Clause       |
| `postgres`    | `15-alpine`                    | Primary database             | PostgreSQL License |
| `minio/minio` | `RELEASE.2024-11-07T00-52-20Z` | S3-compatible object storage | AGPL-3.0           |

### Docker Network

- **Network:** `-dev-network` (bridge driver)
- **Named Volumes:** `redis-dev-data`, `minio-dev-data`, `postgres-dev-data`

### Service Port Mapping

| Service                   | Default Port |
| ------------------------- | ------------ |
| nginx                     | `80`         |
| auth-service              | `3002`       |
| stocks-service            | `3003`       |
| payments-service          | `3004`       |
| ticketing-service         | `3001`       |
| storage-service           | `3005`       |
| web (Next.js)             | `3000`       |
| panels (Next.js)          | `4000`       |
| rm-distributors (Next.js) | `8000`       |
| Redis                     | `6379`       |
| PostgreSQL                | `5432`       |
| MinIO API                 | `9000`       |
| MinIO Console             | `9001`       |

---

## 8. Android TWA Dependencies

| Dependency                        | Version          | License    |
| --------------------------------- | ---------------- | ---------- |
| Android Gradle Plugin             | `8.9.1`          | Apache-2.0 |
| `com.google.androidbrowserhelper` | `2.6.2`          | Apache-2.0 |
| Android `compileSdkVersion`       | `36`             | —          |
| Android `minSdkVersion`           | `21`             | —          |
| Android `targetSdkVersion`        | `36`             | —          |
| Gradle wrapper                    | (project-local)  | Apache-2.0 |
| Generated via                     | `bubblewrap-cli` | Apache-2.0 |

---

## 9. Build & Dev Toolchain

| Tool               | Version               | Purpose                               |
| ------------------ | --------------------- | ------------------------------------- |
| **pnpm**           | `9.0.0`               | Package manager (workspaces)          |
| **Turborepo**      | `^2.5.8`              | Monorepo task orchestration & caching |
| **NestJS CLI**     | `^11.0.0`             | Backend scaffolding & build           |
| **Next.js**        | `^16.1.4` / `16.2.4`  | Frontend framework                    |
| **Prisma**         | `^6.17.1` – `^6.18.0` | ORM & database migrations             |
| **ESLint**         | `^9.18.0` – `^9.38.0` | Linting                               |
| **Prettier**       | `^3.4.2` – `^3.6.2`   | Code formatting                       |
| **Jest**           | `^30.0.0`             | Unit testing                          |
| **ts-jest**        | `^29.2.5`             | TypeScript Jest transformer           |
| **Docker Compose** | v2 (file format)      | Container orchestration               |
| **Bubblewrap CLI** | latest                | Android TWA generation                |

---

## 10. Security-Relevant Notes

### 10.1 Packages with Native/Binary Add-ons

| Package     | Notes                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| `bcrypt`    | C++ native addon for password hashing. Requires build tools at install time.   |
| `puppeteer` | Downloads Chromium binary (~300MB). Used for PDF generation in stocks-service. |

### 10.2 License Summary

| License          | Count | Notes                                                                        |
| ---------------- | ----- | ---------------------------------------------------------------------------- |
| **MIT**          | ~100+ | Majority of packages                                                         |
| **Apache-2.0**   | ~12   | TypeScript, Prisma, AWS SDK, rxjs, Puppeteer, xlsx, class-variance-authority |
| **ISC**          | 3     | lucide-react, canvas-confetti                                                |
| **Artistic-2.0** | 1     | reflect-metadata                                                             |
| **BSD-2-Clause** | 1     | dotenv                                                                       |
| **AGPL-3.0**     | 1     | MinIO (Docker image only — not bundled in app code)                          |
| **PostgreSQL**   | 1     | PostgreSQL (Docker image only)                                               |
| **BSD-3-Clause** | 1     | Redis (Docker image only)                                                    |

> ⚠️ **AGPL-3.0 Notice:** MinIO is used as a Docker container only. No MinIO source code is linked into the application. If distributing as a SaaS, review AGPL-3.0 obligations carefully.

### 10.3 Known Deprecation Warnings

| Package                     | Current  | Available                     | Priority                |
| --------------------------- | -------- | ----------------------------- | ----------------------- |
| `pnpm`                      | `9.0.0`  | `11.20.0`                     | Medium                  |
| `prisma` / `@prisma/client` | `6.18.0` | `7.9.1`                       | Low (major)             |
| `fastify-cookie`            | `^5.7.0` | Replaced by `@fastify/cookie` | Low (auth-service only) |

### 10.4 External SaaS / API Dependencies

| Service            | Package                                        | Purpose             |
| ------------------ | ---------------------------------------------- | ------------------- |
| **Cashfree**       | `cashfree-pg`, `@cashfreepayments/cashfree-js` | Payment gateway     |
| **Twilio**         | `twilio`                                       | OTP via SMS         |
| **Netcore Cloud**  | REST API (`fetch`)                             | Transactional email |
| **Google OAuth**   | `@react-oauth/google`                          | Social login        |
| **AWS S3 / MinIO** | `@aws-sdk/client-s3`                           | File storage        |

---

_This SBOM was generated by scanning all `package.json` files, `docker-compose.dev.yml`, and Android Gradle build files across the monorepo._
