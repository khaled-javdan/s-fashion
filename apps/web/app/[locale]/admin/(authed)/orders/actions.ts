"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { OrderStatus } from "@workspace/db"

import { auth } from "@/lib/auth"
import { reportError } from "@/lib/errors"
import {
  getOrderById,
  updateOrderStatus,
  InsufficientStockError,
} from "@/lib/repos/orders.repo"

/**
 * Result envelope shared by every status-transition action. Expected errors are
 * returned (never thrown) per SPEC §3.
 */
export type ActionResult<T = { status: OrderStatus }> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/**
 * Statuses an admin can move an order to. PENDING_VERIFICATION is excluded — a
 * verified order should never be pushed back into the pre-verification state;
 * that's an internal lifecycle status, not an admin action.
 *
 * Transitions are otherwise any→any so an accidental cancel/refusal can be
 * reverted immediately (re-deducting stock in the repo, which surfaces an
 * out-of-stock error if the goods sold out in the meantime).
 */
const SETTABLE_STATUSES = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUSED,
  OrderStatus.CANCELLED,
] as const

const orderIdSchema = z.object({ orderId: z.string().min(1) })

const cancelSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
})

const setStatusSchema = z.object({
  orderId: z.string().min(1),
  to: z.enum(SETTABLE_STATUSES),
  reason: z.string().trim().max(500).optional(),
})

/**
 * Shared transition runner:
 *   1. Verify an authenticated admin session.
 *   2. Re-load the order (reject a missing one).
 *   3. Call updateOrderStatus (repo appends the OrderEvent, sets the timestamp,
 *      re-credits stock when entering CANCELLED/REFUSED, and re-deducts stock —
 *      possibly failing with InsufficientStockError — when leaving them).
 *   4. revalidatePath the list + the detail page.
 *
 * Any-status → any-status (within SETTABLE_STATUSES); the only hard guard is the
 * stock re-deduction, which keeps an un-cancel from overselling.
 */
async function transition(
  orderId: string,
  to: OrderStatus,
  reason?: string,
): Promise<ActionResult> {
  const session = await auth()
  const actorId = session?.user?.id
  if (!actorId) {
    return { ok: false, error: "Not authenticated" }
  }

  const order = await getOrderById(orderId)
  if (!order) {
    return { ok: false, error: "Order not found" }
  }

  try {
    await updateOrderStatus(orderId, to, actorId, reason)
  } catch (err) {
    // Reverting a cancel/refusal can fail if a line item sold out since — give
    // the admin a clear, actionable message instead of a generic failure.
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: "insufficient_stock" }
    }
    reportError("orders.transition", err, { orderId, to })
    return { ok: false, error: "Failed to update order status" }
  }

  // Route group must be included in the path so the cache entry matches.
  revalidatePath("/[locale]/admin/(authed)/orders", "page")
  revalidatePath("/[locale]/admin/(authed)/orders/[id]", "page")

  return { ok: true, data: { status: to } }
}

/**
 * Generic any→any status setter used by the admin order detail UI. Validates
 * the target status, then defers to the shared runner.
 */
export async function setOrderStatusAction(
  input: z.input<typeof setStatusSchema>,
): Promise<ActionResult> {
  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, parsed.data.to, parsed.data.reason)
}

// Named helpers — thin wrappers over the generic setter, kept for existing
// callers / convenience.
export async function confirmOrder(
  input: z.input<typeof orderIdSchema>,
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, OrderStatus.CONFIRMED)
}

export async function shipOrder(
  input: z.input<typeof orderIdSchema>,
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, OrderStatus.SHIPPED)
}

export async function deliverOrder(
  input: z.input<typeof orderIdSchema>,
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, OrderStatus.DELIVERED)
}

export async function refuseOrder(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, OrderStatus.REFUSED, parsed.data.reason)
}

export async function cancelOrder(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  return transition(parsed.data.orderId, OrderStatus.CANCELLED, parsed.data.reason)
}
