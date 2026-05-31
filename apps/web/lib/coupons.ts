import type { CouponType as DbCouponType } from "@workspace/db"

/**
 * Client-safe mirror of the Prisma `CouponType` enum.
 *
 * Importing the enum's runtime *value* from `@workspace/db` drags the Prisma
 * client (which pulls `node:fs`) into the browser bundle and crashes client
 * components. This object is a plain literal that client code can use exactly
 * like the Prisma enum (`CouponType.PERCENT`), while `satisfies` keeps it in
 * lockstep with the schema — adding a member to the Prisma enum without
 * updating this fails to compile. (Same pattern as `EMIRATES` in the checkout
 * form.)
 */
export const CouponType = {
  PERCENT: "PERCENT",
  FIXED: "FIXED",
} as const satisfies Record<DbCouponType, DbCouponType>

export type CouponType = DbCouponType
