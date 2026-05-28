// =============================================================================
// TRACK D NOTE — this file is officially OWNED by Track B per SPEC.md §8.
// Track B's expected full surface (per SPEC):
//   - findAdminByEmail(email)
//   - createAdmin(input)
//   - verifyPassword(email, plain)
//
// At the time Track D ran, Track B had landed the Prisma schema, migration, and
// `@workspace/db` client singleton, but had NOT yet created any repo files
// under `apps/web/lib/repos/`. To keep Track D's auth + create-admin CLI
// type-safe and runnable, we ship a minimal, correct implementation here.
// Track B's final pass over this file should keep the function signatures
// intact (auth.ts and scripts/create-admin.ts import them directly).
// =============================================================================
import bcrypt from "bcryptjs"

import { prisma } from "@workspace/db"
import type { AdminRole, AdminUser } from "@workspace/db"

export type CreateAdminInput = {
  email: string
  passwordHash: string
  name: string
  role: AdminRole
}

export async function findAdminByEmail(
  email: string,
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  })
}

export async function createAdmin(
  input: CreateAdminInput,
): Promise<AdminUser> {
  return prisma.adminUser.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      name: input.name,
      role: input.role,
    },
  })
}

export type VerifyPasswordResult =
  | { ok: true; user: AdminUser }
  | { ok: false }

// Used to keep verifyPassword's timing roughly constant when the email is
// unknown, so attackers can't enumerate registered admin emails by measuring
// how long the response takes.
const FAKE_BCRYPT_HASH =
  "$2b$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTUV01234"

/**
 * Looks up an admin by email and compares the supplied plaintext password
 * against the stored bcrypt hash. Never throws.
 */
export async function verifyPassword(
  email: string,
  plain: string,
): Promise<VerifyPasswordResult> {
  try {
    const user = await findAdminByEmail(email)
    // Always run bcrypt.compare — even with a fake hash when the user is missing
    // — so the call duration doesn't reveal whether the email exists.
    const hash = user?.passwordHash ?? FAKE_BCRYPT_HASH
    const matches = await bcrypt.compare(plain, hash)
    if (!user || !matches) return { ok: false }
    return { ok: true, user }
  } catch {
    return { ok: false }
  }
}
