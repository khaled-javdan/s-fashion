"use client"

import { useEffect } from "react"

import { useCartStore } from "@/lib/cart-store"

// Must match the checkout form's persistence key.
const FORM_STORAGE_KEY = "s-fashion-checkout-form-v2"

/**
 * Clears the cart + saved checkout form after a successful Stripe payment.
 *
 * The checkout form deliberately keeps both through the Stripe redirect (so a
 * customer who cancels at Stripe can retry instantly); this runs on the
 * confirmation page only when the order is a PAID Stripe order reached via the
 * Checkout success redirect. Guarded per order number so a later visit with a
 * freshly-refilled cart is untouched. Renders nothing.
 */
export function StripeReturnCleanup({ orderNumber }: { orderNumber: string }) {
  const clear = useCartStore((s) => s.clear)

  useEffect(() => {
    const key = `s-fashion-stripe-cleaned:${orderNumber}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Private mode — clearing twice is harmless; fall through.
    }
    clear()
    try {
      sessionStorage.removeItem(FORM_STORAGE_KEY)
    } catch {
      // best-effort
    }
  }, [orderNumber, clear])

  return null
}
