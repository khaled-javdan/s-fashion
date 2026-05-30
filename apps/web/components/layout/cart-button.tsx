"use client"

import { useState } from "react"
import { ShoppingBag } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetTrigger } from "@workspace/ui/components/sheet"

import { CartDrawer } from "@/components/cart/cart-drawer"
import {
  selectHasHydrated,
  selectItemCount,
  useCartStore,
} from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"

/**
 * Cart trigger in the header.
 *
 * Replaces the Round 1 `<Link>` with a `Sheet` trigger that opens the cart
 * drawer (same UX on mobile and desktop). The unread-count badge reads
 * `itemCount` from the store, but is gated behind `hasHydrated` so the
 * server-rendered first paint shows an empty cart (count 0) and the real
 * count only appears once localStorage has rehydrated — avoiding a hydration
 * mismatch.
 *
 * `locale` is accepted to keep the header's call site stable; the drawer
 * derives the locale it needs from `next-intl` directly.
 */
export function CartButton({
  label,
}: {
  label: string
  locale: Locale
}) {
  const [open, setOpen] = useState(false)
  const itemCount = useCartStore(selectItemCount)
  const hasHydrated = useCartStore(selectHasHydrated)

  const showBadge = hasHydrated && itemCount > 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className="relative"
        >
          <ShoppingBag aria-hidden="true" />
          {showBadge && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {itemCount}
            </span>
          )}
          <span className="sr-only">
            {label} ({hasHydrated ? itemCount : 0})
          </span>
        </Button>
      </SheetTrigger>
      <CartDrawer onClose={() => setOpen(false)} />
    </Sheet>
  )
}
