/**
 * Shared low-stock urgency model.
 *
 * One place decides what "running out" means so the product card, the PDP
 * picker, the size chips and the mobile sticky bar all draw the same line.
 * Pure and dependency-free (no Prisma, no client-only imports) so both the
 * server components and the client picker can import it.
 *
 * The numbers shown to shoppers are always the real `ProductVariant.stock` —
 * urgency here is a presentation layer over true inventory, never a fabricated
 * countdown.
 */

/** At or below this, a variant is nearly gone — loudest treatment. */
export const CRITICAL_STOCK_THRESHOLD = 2

/** At or below this, we nudge with a count ("Only 4 left"). */
export const LOW_STOCK_THRESHOLD = 5

/**
 * Denominator for the depletion meter. Stock above this reads as "plenty", so
 * the bar is full and the urgency treatment is off.
 */
export const STOCK_METER_CAPACITY = 10

/** Days of sales history behind the "N sold recently" social proof. */
export const RECENT_SALES_WINDOW_DAYS = 7

/** Below this many recent sales the social-proof line stays hidden. */
export const MIN_RECENT_SALES_TO_SHOW = 3

export type StockLevel = "out" | "critical" | "low" | "ok"

/** Bucket a stock count into the level that drives the visual treatment. */
export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out"
  if (stock <= CRITICAL_STOCK_THRESHOLD) return "critical"
  if (stock <= LOW_STOCK_THRESHOLD) return "low"
  return "ok"
}

/** True when the count is worth surfacing with urgency styling. */
export function isUrgent(stock: number): boolean {
  const level = stockLevel(stock)
  return level === "critical" || level === "low"
}

/**
 * How full the depletion meter is, 0–100. Clamped at both ends and floored at
 * 6% so a single remaining unit still renders a visible sliver of bar.
 */
export function stockMeterPercent(stock: number): number {
  if (stock <= 0) return 0
  const raw = (stock / STOCK_METER_CAPACITY) * 100
  return Math.max(6, Math.min(100, Math.round(raw)))
}
