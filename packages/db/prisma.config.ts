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

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set (checked repo-root .env.local).")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
    // Neon's pooled URL can't run migrations (PgBouncer transaction mode
    // doesn't support prepared statements), so we route migrate/* to the
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
