// Prisma 6 + pnpm: when `generator client { output = "..." }` is set, the
// generated client lives at `packages/db/node_modules/.prisma/client/`.
// pnpm hoists `@prisma/client` under `.pnpm/...`, so its internal `require('.prisma/client/default')`
// can't find our generated client. We import the runtime + types directly from
// the local output to avoid that resolution problem.
import { PrismaNeon } from "@prisma/adapter-neon"

import { PrismaClient } from "../node_modules/.prisma/client/index.js"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  // Pooled connection for the runtime (Neon serverless adapter). Accept either
  // our own DATABASE_URL (local dev) or POSTGRES_URL (auto-provisioned per
  // environment by the Neon–Vercel integration), so prod and preview each use
  // their own branch with no manual env duplication.
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL / POSTGRES_URL is not set.")
  }
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  })
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

// Re-export everything so consumers can `import { Prisma, Order, OrderStatus } from "@workspace/db"`.
export * from "../node_modules/.prisma/client/index.js"
