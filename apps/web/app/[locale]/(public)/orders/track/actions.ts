"use server"

import { parsePhoneNumberFromString } from "libphonenumber-js"
import { headers } from "next/headers"
import { z } from "zod"

import type { TrackStatus, TrackResult } from "@/components/order/order-tracking-types"
import { reportError } from "@/lib/errors"
import { getOrderByNumber } from "@/lib/repos/orders.repo"
import { tryAcquire } from "@/lib/services/rate-limit"

/**
 * Public order-tracking lookup.
 *
 * Order numbers are sequential and therefore guessable (`SF-2026-00007`), and
 * the order record holds customer PII. So this lookup requires a SECOND factor
 * — the phone number used at checkout — and is rate-limited per IP and per
 * order number to blunt enumeration / phone brute-forcing. On any miss it
 * returns a single generic `not_found` so it never reveals whether an order
 * number exists.
 */

const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const IP_LIMIT = 15
const ORDER_LIMIT = 6

const inputSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  phone: z.string().trim().min(1).max(40),
})

/** Best-effort client IP from the proxy chain. */
async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  const first = fwd?.split(",")[0]?.trim()
  if (first) return first
  return h.get("x-real-ip") ?? "unknown"
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

export async function trackOrderAction(input: {
  orderNumber: string
  phone: string
}): Promise<TrackResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "invalid" }

  const orderNumber = parsed.data.orderNumber.toUpperCase()

  // Rate-limit before touching the DB — per IP and per requested order number.
  const ip = await getClientIp()
  const ipOk = tryAcquire(`track:ip:${ip}`, IP_LIMIT, WINDOW_MS)
  const orderOk = tryAcquire(`track:order:${orderNumber}`, ORDER_LIMIT, WINDOW_MS)
  if (!ipOk || !orderOk) return { ok: false, error: "rate_limited" }

  // Normalise the phone to E.164 (UAE default region) to match stored format.
  const phone = parsePhoneNumberFromString(parsed.data.phone, "AE")
  if (!phone || !phone.isValid()) return { ok: false, error: "not_found" }

  try {
    const order = await getOrderByNumber(orderNumber)
    // Generic miss for "no such order" AND "phone doesn't match" — never leak
    // which one it was.
    if (!order || order.phone !== phone.number) {
      return { ok: false, error: "not_found" }
    }

    return {
      ok: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status as TrackStatus,
        createdAt: order.createdAt.toISOString(),
        confirmedAt: iso(order.confirmedAt),
        shippedAt: iso(order.shippedAt),
        deliveredAt: iso(order.deliveredAt),
        cancelledAt: iso(order.cancelledAt),
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        totalFils: order.totalFils,
        locale: order.locale,
      },
    }
  } catch (err) {
    reportError("trackOrderAction", err)
    return { ok: false, error: "not_found" }
  }
}
