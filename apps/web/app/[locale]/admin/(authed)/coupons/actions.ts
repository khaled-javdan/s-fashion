"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@workspace/db"

import { auth } from "@/lib/auth"
import {
  createCoupon,
  deactivateCoupon,
  updateCoupon,
} from "@/lib/repos/coupons.repo"
import {
  couponWriteSchema,
  type CouponWriteSchemaInput,
} from "@/lib/schemas/coupon.schema"

/** Standard action result. Expected errors are returned, never thrown. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: "Not authorized." }
  }
  return { ok: true }
}

function zodMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown[] }).issues)
  ) {
    const issues = (
      err as { issues: Array<{ path: unknown[]; message: string }> }
    ).issues
    const first = issues[0]
    if (first) {
      const path = first.path.join(".")
      return path ? `${path}: ${first.message}` : first.message
    }
  }
  return "Invalid coupon data."
}

function dbMessage(err: unknown): string {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return "A coupon with that code already exists."
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return "Coupon not found."
  }
  console.error("[coupons.actions]", err)
  return "Something went wrong. Please try again."
}

/** Create a coupon. Returns the new id so the client can navigate / refresh. */
export async function createCouponAction(
  payload: CouponWriteSchemaInput,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  const parsed = couponWriteSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: zodMessage(parsed.error) }
  }

  try {
    const coupon = await createCoupon(parsed.data)
    revalidatePath("/[locale]/admin/(authed)/coupons", "page")
    return { ok: true, data: { id: coupon.id } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}

/** Update an existing coupon. */
export async function updateCouponAction(
  id: string,
  payload: CouponWriteSchemaInput,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing coupon id." }
  }

  const parsed = couponWriteSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: zodMessage(parsed.error) }
  }

  try {
    const coupon = await updateCoupon(id, parsed.data)
    revalidatePath("/[locale]/admin/(authed)/coupons", "page")
    return { ok: true, data: { id: coupon.id } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}

/** Soft-disable a coupon (stops new redemptions; keeps history). */
export async function deactivateCouponAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const authed = await requireAdmin()
  if (!authed.ok) return authed

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Missing coupon id." }
  }

  try {
    const coupon = await deactivateCoupon(id)
    revalidatePath("/[locale]/admin/(authed)/coupons", "page")
    return { ok: true, data: { id: coupon.id } }
  } catch (err) {
    return { ok: false, error: dbMessage(err) }
  }
}
