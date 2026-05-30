"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { OrderStatus } from "@workspace/db"

import { auth } from "@/lib/auth"
import { getOrderById, updateOrderStatus } from "@/lib/repos/orders.repo"

/**
 * Result envelope shared by every status-transition action. Expected errors are
 * returned (never thrown) per SPEC §3.
 */
export type ActionResult<T = { status: OrderStatus }> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Valid forward transitions per ROUND-2.md Track G task 2. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_VERIFICATION]: [],
  [OrderStatus.NEW]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUSED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.REFUSED]: [],
  [OrderStatus.CANCELLED]: [],
}

const orderIdSchema = z.object({ orderId: z.string().min(1) })

const cancelSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
})

/**
 * Shared transition runner:
 *   1. Verify an authenticated admin session.
 *   2. Re-load the order and re-check the current status (reject invalid moves).
 *   3. Call updateOrderStatus (repo appends the OrderEvent, sets the timestamp,
 *      and re-credits stock on CANCELLED/REFUSED).
 *   4. revalidatePath the list + the detail page.
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

  if (!ALLOWED_TRANSITIONS[order.status].includes(to)) {
    return {
      ok: false,
      error: `Cannot move order from ${order.status} to ${to}`,
    }
  }

  try {
    await updateOrderStatus(orderId, to, actorId, reason)
  } catch {
    return { ok: false, error: "Failed to update order status" }
  }

  // Route group must be included in the path so the cache entry matches.
  revalidatePath("/[locale]/admin/(authed)/orders", "page")
  revalidatePath("/[locale]/admin/(authed)/orders/[id]", "page")

  return { ok: true, data: { status: to } }
}

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
