"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { selectItemCount, useCartStore } from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"

/**
 * Cart trigger in the header.
 *
 * Reads `itemCount` from the Zustand store — empty in Round 1, populated by
 * Track F in Round 2. Renders a small numeric badge in the inline-end corner
 * of the icon when there are items in the cart.
 *
 * The actual cart drawer is owned by Track F. For now we link to a
 * `/{locale}/cart` route that doesn't exist yet — Track F will create it.
 */
export function CartButton({
  label,
  locale,
}: {
  label: string
  locale: Locale
}) {
  const itemCount = useCartStore(selectItemCount)

  return (
    <Button
      asChild
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className="relative"
    >
      <Link href={`/${locale}/cart`} prefetch={false}>
        <ShoppingBag aria-hidden="true" />
        {itemCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          >
            {itemCount}
          </span>
        )}
        <span className="sr-only">
          {label} ({itemCount})
        </span>
      </Link>
    </Button>
  )
}
