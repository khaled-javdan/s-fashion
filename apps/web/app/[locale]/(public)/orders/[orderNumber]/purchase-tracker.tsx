"use client"

import { useEffect } from "react"

import { purchase, type AnalyticsLine } from "@/lib/analytics/data-layer"

type Props = {
  orderNumber: string
  totalFils: number
  shippingFils: number
  lines: AnalyticsLine[]
}

/**
 * Fires the GA4 `purchase` event exactly once per order.
 *
 * The confirmation page is a permalink server component (`/orders/[number]`),
 * so a naive "fire on load" would double-count on refresh or revisit. We guard
 * with a `sessionStorage` flag keyed by order number — the standard de-dupe for
 * confirmation pages. (`transaction_id` also lets GA4 de-dupe server-side as a
 * backstop.)
 *
 * Renders nothing.
 */
export function PurchaseTracker({
  orderNumber,
  totalFils,
  shippingFils,
  lines,
}: Props) {
  useEffect(() => {
    const key = `s-fashion-purchase-tracked:${orderNumber}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Private mode / storage disabled — fall through and fire anyway rather
      // than lose the conversion. Refresh may then double-count, but GA4's
      // transaction_id de-dupe covers it.
    }
    purchase({ orderNumber, totalFils, shippingFils, lines })
  }, [orderNumber, totalFils, shippingFils, lines])

  return null
}

export default PurchaseTracker
