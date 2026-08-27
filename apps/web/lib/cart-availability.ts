/**
 * Shared shape for "this cart line can't be ordered as-is", produced by the
 * checkout action and consumed by the client dialog that offers the fix.
 *
 * Lives outside the server action module so the client bundle can import the
 * type (and the pure helpers below) without pulling the action in.
 */

import type { CartItem } from "@/lib/cart-store"

/**
 * A cart line the server refused.
 *
 * - `sold_out`     — still sold, nothing left right now.
 * - `limited`      — fewer units left than the cart asks for; `available` > 0.
 * - `discontinued` — the variant is gone (deleted/archived) or its product was
 *   deactivated, so it can never come back for this cart line.
 */
export type UnavailableLine = {
  variantId: string
  /** Units the customer may still take (0 = none). */
  available: number
  reason: "sold_out" | "limited" | "discontinued"
}

/** The fix a line needs: drop it, or keep only what's left. */
export type AvailabilityFix =
  | { kind: "remove" }
  | { kind: "reduce"; to: number }

/**
 * What to do with a refused line. A line with stock left is reduced (the
 * customer keeps what they can get); anything else is removed.
 */
export function fixFor(line: UnavailableLine): AvailabilityFix {
  return line.available > 0
    ? { kind: "reduce", to: line.available }
    : { kind: "remove" }
}

/** Pair each refused line with the cart item it refers to, dropping strays. */
export function withCartItems(
  lines: UnavailableLine[],
  items: CartItem[],
): { line: UnavailableLine; item: CartItem }[] {
  const byVariant = new Map(items.map((i) => [i.variantId, i]))
  return lines.flatMap((line) => {
    const item = byVariant.get(line.variantId)
    return item ? [{ line, item }] : []
  })
}
