/**
 * Shared, runtime-free types for customer order tracking. Imported by both the
 * `trackOrderAction` server action and the client tracker/form, kept in a
 * neutral module so neither pulls the other's runtime in.
 */

export type TrackStatus =
  | "PENDING_VERIFICATION"
  | "NEW"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "REFUSED"
  | "CANCELLED"

/** Safe, minimal order summary returned to the public tracker. No PII. */
export type TrackedOrder = {
  orderNumber: string
  status: TrackStatus
  /** ISO timestamps (or null when the stage hasn't happened). */
  createdAt: string
  confirmedAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  itemCount: number
  totalFils: number
  locale: string
}

export type TrackErrorCode = "not_found" | "rate_limited" | "invalid"

export type TrackResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; error: TrackErrorCode }
