import "server-only"

import NextAuth, {
  type DefaultSession,
  type NextAuthResult,
} from "next-auth"
import Credentials from "next-auth/providers/credentials"
// Side-effect import so TS picks up the JWT module before our augmentation.
import "next-auth/jwt"

import { verifyPassword } from "@/lib/repos/admin-users.repo"
import { adminLoginSchema } from "@/lib/schemas/admin-login.schema"

/**
 * Admin role mirror — kept in sync with `AdminRole` enum from
 * `@workspace/db` (Track B). Re-declared here so the auth module can be
 * typed before Prisma's generated client exists.
 */
export type AdminRole = "OWNER" | "STAFF"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: AdminRole
    } & DefaultSession["user"]
  }

  interface User {
    role?: AdminRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: AdminRole
  }
}

const result: NextAuthResult = NextAuth({
  // JWT session strategy — no DB adapter for v1 (per SPEC §8 Track D).
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Admin credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = adminLoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const result = await verifyPassword(
          parsed.data.email,
          parsed.data.password,
        )
        if (!result.ok) return null

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.id
        token.role = (user as { role?: AdminRole }).role ?? token.role
      }
      return token
    },
    async session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id
      if (token.role === "OWNER" || token.role === "STAFF") {
        session.user.role = token.role
      }
      return session
    },
  },
})

export const handlers: NextAuthResult["handlers"] = result.handlers
export const auth: NextAuthResult["auth"] = result.auth
export const signIn: NextAuthResult["signIn"] = result.signIn
export const signOut: NextAuthResult["signOut"] = result.signOut
