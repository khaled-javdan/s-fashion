"use client"

import { useEffect } from "react"

import { useCartStore } from "@/lib/cart-store"

/**
 * Seeds the cart store's live per-variant quantity cap from the server
 * `order.max_qty_per_variant` setting.
 *
 * The store can't read the (async, request-scoped) setting at module load, so
 * the public layout fetches it server-side and hands it down here; this mount
 * pushes it into the store on hydration. Keeps the cart stepper, add-to-cart
 * clamp, and the server's checkout validation all agreeing on the same cap.
 * Renders nothing.
 */
export function CartConfigMount({
  maxQtyPerVariant,
}: {
  maxQtyPerVariant: number
}) {
  const setMaxQtyPerVariant = useCartStore((s) => s.setMaxQtyPerVariant)

  useEffect(() => {
    setMaxQtyPerVariant(maxQtyPerVariant)
  }, [maxQtyPerVariant, setMaxQtyPerVariant])

  return null
}
