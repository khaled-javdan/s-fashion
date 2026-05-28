#!/usr/bin/env tsx
/**
 * Create an admin user from CLI args or env vars.
 *
 * Usage:
 *   pnpm -F web tsx scripts/create-admin.ts \
 *     --email you@example.com --password secret123 --name "Khaled" --role OWNER
 *
 * Env fallback (used when a flag is missing):
 *   EMAIL, PASSWORD, NAME, ROLE
 *
 * ROLE defaults to STAFF when omitted. Hashes password with bcrypt (12 rounds).
 *
 * The script auto-loads the workspace `.env.local` at the repo root so
 * `DATABASE_URL` and friends are available without `tsx --env-file`.
 */
import fs from "node:fs"
import path from "node:path"
import url from "node:url"

// We load env BEFORE importing the repo (and the Prisma client) because
// PrismaClient reads `DATABASE_URL` at construction time. Using static
// imports for `@/lib/repos/...` would resolve and instantiate Prisma
// before this code runs, so we lazy-import after `loadEnvLocal()`.
function loadEnvLocal() {
  try {
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const envPath = path.resolve(here, "..", "..", "..", ".env.local")
    if (!fs.existsSync(envPath)) return
    const raw = fs.readFileSync(envPath, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // Best-effort — don't crash on env loading errors. The user can still
    // pass DATABASE_URL via the shell or via `tsx --env-file`.
  }
}

type AdminRole = "OWNER" | "STAFF"

type Args = {
  email?: string
  password?: string
  name?: string
  role?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a || !a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      ;(args as Record<string, string>)[key] = next
      i++
    } else {
      ;(args as Record<string, string>)[key] = "true"
    }
  }
  return args
}

function isAdminRole(value: string): value is AdminRole {
  return value === "OWNER" || value === "STAFF"
}

async function main() {
  loadEnvLocal()

  const argv = process.argv.slice(2)
  const flags = parseArgs(argv)

  const email = flags.email ?? process.env.EMAIL
  const password = flags.password ?? process.env.PASSWORD
  const name = flags.name ?? process.env.NAME
  const roleRaw = flags.role ?? process.env.ROLE ?? "STAFF"

  if (!email || !password || !name) {
    console.error(
      "Missing required fields. Provide --email, --password, --name (or EMAIL, PASSWORD, NAME env vars).",
    )
    process.exit(1)
  }

  if (!isAdminRole(roleRaw)) {
    console.error(`Invalid role "${roleRaw}". Expected OWNER or STAFF.`)
    process.exit(1)
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.")
    process.exit(1)
  }

  try {
    // Lazy import after env is populated so PrismaClient sees DATABASE_URL.
    const [{ default: bcrypt }, { createAdmin, findAdminByEmail }] =
      await Promise.all([
        import("bcryptjs"),
        import("@/lib/repos/admin-users.repo"),
      ])

    const existing = await findAdminByEmail(email)
    if (existing) {
      console.error(`Admin already exists for email "${email}".`)
      process.exit(1)
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createAdmin({
      email,
      passwordHash,
      name,
      role: roleRaw,
    })

    console.log(
      `Created admin ${user.email} (${user.role}) — id=${user.id}, name=${user.name}`,
    )
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to create admin: ${message}`)
    process.exit(1)
  }
}

main()
