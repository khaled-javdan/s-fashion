/**
 * Cart store (Zustand) — Track A stub.
 *
 * This file exposes only the read shape that Track A's header needs to display
 * the cart count badge (`items: []`, `itemCount: 0`). Track F (Round 2) will
 * extend the store to support add/remove/update/persist.
 *
 * Intended final shape (target for Track F):
 *
 * ```ts
 * type CartItem = {
 *   variantId: string
 *   productId: string
 *   slug: string
 *   nameAr: string
 *   nameEn: string
 *   colorNameAr: string | null
 *   colorNameEn: string | null
 *   colorHex: string | null
 *   size: Size               // from @workspace/db
 *   imageUrl: string | null
 *   unitPriceFils: number    // snapshot at the time of add
 *   quantity: number         // 1..2 (see Setting order.max_qty_per_variant)
 * }
 *
 * type CartState = {
 *   items: CartItem[]
 *
 *   // selectors
 *   itemCount: number               // sum of quantities
 *   subtotalFils: number            // sum of unitPriceFils * quantity
 *
 *   // mutations (all derive new state, never mutate in place)
 *   add(item: CartItem): void
 *   remove(variantId: string): void
 *   setQuantity(variantId: string, quantity: number): void
 *   clear(): void
 * }
 * ```
 *
 * Track F should wrap this store with `persist` (localStorage, key
 * `s-fashion-cart`) and a `partialize` that only persists `items`, then derive
 * `itemCount` / `subtotalFils` lazily so they stay in sync after rehydration.
 */

import { create } from "zustand"

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
  unitPriceFils: number
  quantity: number
}

export type CartState = {
  items: CartItem[]
  itemCount: number
}

/**
 * Read-only Zustand store. The mutation surface is intentionally empty in
 * Round 1 — Track F replaces this implementation.
 */
export const useCartStore = create<CartState>()(() => ({
  items: [],
  itemCount: 0,
}))

/** Selector helpers — kept here so consumer components can be Track F-agnostic. */
export const selectItems = (state: CartState): CartItem[] => state.items
export const selectItemCount = (state: CartState): number => state.itemCount
