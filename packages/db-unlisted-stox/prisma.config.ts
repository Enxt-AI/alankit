import { defineConfig, env } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"), // Runtime: PgBouncer
    // Migrations: direct connection (bypasses PgBouncer). Optional so `prisma generate`
    // works in Docker builds where DIRECT_DATABASE_URL isn't provided.
    ...(process.env.DIRECT_DATABASE_URL ? { directUrl: process.env.DIRECT_DATABASE_URL } : {}),
  },
});
