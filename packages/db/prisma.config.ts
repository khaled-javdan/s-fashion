import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { defineConfig } from "prisma/config"

// Prisma CLI auto-loads `.env` only — not `.env.local`. Next.js loads
// `.env.local` at runtime; here in CLI-land we load it ourselves so
// `DATABASE_URL` / `DIRECT_URL` resolve during migrate/seed/studio.
// __dirname is CJS-native; tsx polyfills it for TS files as well.
const repoRootEnv = resolve(__dirname, "../../.env.local")
if (existsSync(repoRootEnv)) {
  process.loadEnvFile(repoRootEnv)
}

// Neon's pooled URL can't run migrations: PgBouncer transaction mode doesn't
// hold session-level advisory locks across statements, so `prisma migrate`'s
// `pg_advisory_lock` times out (P1002). Route migrate/seed/studio through a
// *direct* (unpooled) connection instead. On Vercel the Neon integration
// provisions the unpooled URL as `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`;
// locally set `DIRECT_URL` in `.env.local`. Fall back to the pooled URL only
// when no direct URL exists (e.g. a non-Neon local Postgres that has no pooler).
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL
if (!migrationUrl) {
  throw new Error(
    "No database URL set: provide DIRECT_URL / DATABASE_URL_UNPOOLED / " +
      "POSTGRES_URL_NON_POOLING / DATABASE_URL (checked repo-root .env.local).",
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
