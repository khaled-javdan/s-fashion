/**
 * Per-variant quantity limits, shared by the storefront, cart store, server
 * schemas, and the checkout action so they never drift.
 *
 * The live cap is the admin-configurable `order.max_qty_per_variant` setting;
 * these constants are the fallback (when unset) and the absolute hard ceiling
 * (matches the settings form validator's `.max(20)`). Server-safe: no Prisma
 * or client-only imports, so both edges can import it.
 */

/** Fallback per-variant cap when `order.max_qty_per_variant` is unset. */
export const DEFAULT_MAX_QTY_PER_VARIANT = 2;

/**
 * Absolute hard ceiling for per-variant quantity. The configured setting can
 * never exceed this (the settings validator caps at 20); schemas use it as a
 * sanity bound while the action enforces the real configured value.
 */
export const ABSOLUTE_MAX_QTY_PER_VARIANT = 20;

/** Clamp a quantity into `[1, max]`, coercing non-finite input to 1. */
export function clampQty(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 1;
  const ceiling = Math.min(max, ABSOLUTE_MAX_QTY_PER_VARIANT);
  return Math.max(1, Math.min(ceiling, Math.trunc(quantity)));
}
