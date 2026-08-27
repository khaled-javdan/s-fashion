"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { useCartStore, type CartItem } from "@/lib/cart-store"

/**
 * Refill the cart from a past order — the landing half of the "back to your
 * basket" link in the recovery email (`/cart?restore=SF-…`).
 *
 * Additive and non-destructive: anything already in the cart is left exactly as
 * it is, and only variants missing from it are added. The lines arrive already
 * filtered and stock-clamped by the server, so nothing unavailable is put back.
 * Runs once, then strips the query param so a refresh doesn't re-run it.
 */
export function CartRestore({ lines }: { lines: CartItem[] }) {
  const t = useTranslations("cart")
  const router = useRouter()
  const add = useCartStore((s) => s.add)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const doneRef = useRef(false)

  useEffect(() => {
    // Wait for localStorage: adding before rehydration would be overwritten.
    if (!hasHydrated || doneRef.current) return
    doneRef.current = true

    const existing = new Set(
      useCartStore.getState().items.map((item) => item.variantId),
    )
    const added = lines.filter((line) => !existing.has(line.variantId))
    for (const line of added) add(line)

    if (added.length > 0) toast.success(t("restored"))
    router.replace(window.location.pathname)
  }, [hasHydrated, lines, add, router, t])

  return null
}
