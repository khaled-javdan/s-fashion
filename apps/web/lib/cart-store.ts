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
 * Quantity clamp: each line item is clamped to `[1, MAX_QTY_PER_VARIANT]`
 * (matches the `order.max_qty_per_variant` setting, default 2). The server
 * re-validates quantities and stock at checkout — the store clamp is a UX
 * convenience, never the source of truth.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Hard client-side clamp for per-variant quantity. Mirrors `order.max_qty_per_variant`. */
export const MAX_QTY_PER_VARIANT = 2

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
  /** 1..MAX_QTY_PER_VARIANT */
  quantity: number
}

export type CartState = {
  items: CartItem[]

  /** True once the persisted state has rehydrated from localStorage. */
  hasHydrated: boolean

  /**
   * Add an item. If the `variantId` is already in the cart, increment its
   * quantity (capped at MAX_QTY_PER_VARIANT). Otherwise append. The passed
   * item's `quantity` is respected as the increment amount (clamped).
   */
  add(item: CartItem): void

  /** Remove a line item by variant id. */
  remove(variantId: string): void

  /**
   * Set the absolute quantity for a variant. Clamped to
   * [1, MAX_QTY_PER_VARIANT]. A quantity < 1 removes the line item.
   */
  setQuantity(variantId: string, quantity: number): void

  /** Empty the cart. */
  clear(): void

  /** Internal: flips `hasHydrated`. Called from `onRehydrateStorage`. */
  setHasHydrated(value: boolean): void
}

function clampQty(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.min(MAX_QTY_PER_VARIANT, Math.trunc(quantity)))
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,

      add: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: clampQty(i.quantity + item.quantity) }
                  : i,
              ),
            }
          }
          return {
            items: [...state.items, { ...item, quantity: clampQty(item.quantity) }],
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
                ? { ...i, quantity: clampQty(quantity) }
                : i,
            ),
          }
        }),

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

export const selectIsEmpty = (state: CartState): boolean =>
  state.items.length === 0

export const selectHasHydrated = (state: CartState): boolean =>
  state.hasHydrated
