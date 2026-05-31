/**
 * Cart store (Zustand + persist) — Track F implementation.
 *
 * Replaces the Round 1 read-only stub. The public surface is the contract the
 * rest of the app builds against:
 *
 * - State: `items`
 * - Mutations: `add`, `remove`, `setQuantity`, `clear`
 * - Selectors: `selectItems`, `selectItemCount`, `selectSubtotalFils`,
 *   `selectIsEmpty`
 * - Hydration: `hasHydrated` flag (set via `onRehydrateStorage`) so the header
 *   badge can render an empty cart on first paint and only reveal the real
 *   count once localStorage has rehydrated.
 *
 * Derived values (`itemCount`, `subtotalFils`) are NOT stored — they live as
 * pure selectors so they stay consistent after rehydration and never drift
 * from `items`.
 *
 * Persistence: wrapped with `persist`, keyed `"s-fashion-cart"`, with a
 * `partialize` that only persists `items` (never the derived/flag fields).
 *
 * Quantity clamp: each line item is clamped to `[1, maxQtyPerVariant]`, where
 * `maxQtyPerVariant` is seeded from the admin `order.max_qty_per_variant`
 * setting (see CartConfigMount) and defaults to {@link DEFAULT_MAX_QTY_PER_VARIANT}
 * until then. The server re-validates quantities and stock at checkout — the
 * store clamp is a UX convenience, never the source of truth.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

import {
  clampQty,
  DEFAULT_MAX_QTY_PER_VARIANT,
} from "@/lib/order-limits"

export type CartItem = {
  variantId: string
  productId: string
  slug: string
  nameAr: string
  nameEn: string
  colorNameAr: string | null
  colorNameEn: string | null
  colorHex: string | null
  size: string
  imageUrl: string | null
  /** Snapshot of the unit price at the time the item was added (integer fils). */
  unitPriceFils: number
  /**
   * Snapshot of the compare-at ("was") price when the item was added, in fils.
   * `null` when the product wasn't on sale. Used to show the customer how much
   * they're saving; display-only, never trusted at checkout.
   */
  compareAtFils: number | null
  /** 1..maxQtyPerVariant */
  quantity: number
}

export type CartState = {
  items: CartItem[]

  /**
   * Live per-variant quantity cap, seeded from the `order.max_qty_per_variant`
   * setting via {@link setMaxQtyPerVariant}. Not persisted — always refreshed
   * from the server on mount.
   */
  maxQtyPerVariant: number

  /** True once the persisted state has rehydrated from localStorage. */
  hasHydrated: boolean

  /**
   * Add an item. If the `variantId` is already in the cart, increment its
   * quantity (capped at `maxQtyPerVariant`). Otherwise append. The passed
   * item's `quantity` is respected as the increment amount (clamped).
   */
  add(item: CartItem): void

  /** Remove a line item by variant id. */
  remove(variantId: string): void

  /**
   * Set the absolute quantity for a variant. Clamped to
   * [1, maxQtyPerVariant]. A quantity < 1 removes the line item.
   */
  setQuantity(variantId: string, quantity: number): void

  /**
   * Set the live per-variant quantity cap (from the server setting) and clamp
   * any existing line items down to it, so a lowered cap can't leave a stale
   * cart that checkout would reject.
   */
  setMaxQtyPerVariant(max: number): void

  /** Empty the cart. */
  clear(): void

  /** Internal: flips `hasHydrated`. Called from `onRehydrateStorage`. */
  setHasHydrated(value: boolean): void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      maxQtyPerVariant: DEFAULT_MAX_QTY_PER_VARIANT,
      hasHydrated: false,

      add: (item) =>
        set((state) => {
          const max = state.maxQtyPerVariant
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: clampQty(i.quantity + item.quantity, max) }
                  : i,
              ),
            }
          }
          return {
            items: [
              ...state.items,
              { ...item, quantity: clampQty(item.quantity, max) },
            ],
          }
        }),

      remove: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),

      setQuantity: (variantId, quantity) =>
        set((state) => {
          if (quantity < 1) {
            return {
              items: state.items.filter((i) => i.variantId !== variantId),
            }
          }
          return {
            items: state.items.map((i) =>
              i.variantId === variantId
                ? { ...i, quantity: clampQty(quantity, state.maxQtyPerVariant) }
                : i,
            ),
          }
        }),

      setMaxQtyPerVariant: (max) =>
        set((state) => ({
          maxQtyPerVariant: max,
          items: state.items.map((i) => ({
            ...i,
            quantity: clampQty(i.quantity, max),
          })),
        })),

      clear: () => set({ items: [] }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "s-fashion-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

// ─── Selectors ────────────────────────────────────────────────────────────
// Derived values live here (not in state) so they stay consistent with
// `items` after rehydration. Consumers pass these to `useCartStore(...)`.

export const selectItems = (state: CartState): CartItem[] => state.items

export const selectItemCount = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.quantity, 0)

export const selectSubtotalFils = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.unitPriceFils * i.quantity, 0)

/**
 * Total amount saved across the cart from on-sale items, in fils — the sum of
 * (compareAt − unit) × quantity for every line whose compare-at price is above
 * its unit price. Returns 0 when nothing is discounted.
 */
export const selectSavingsFils = (state: CartState): number =>
  state.items.reduce((sum, i) => {
    if (i.compareAtFils != null && i.compareAtFils > i.unitPriceFils) {
      return sum + (i.compareAtFils - i.unitPriceFils) * i.quantity
    }
    return sum
  }, 0)

export const selectIsEmpty = (state: CartState): boolean =>
  state.items.length === 0

export const selectHasHydrated = (state: CartState): boolean =>
  state.hasHydrated
