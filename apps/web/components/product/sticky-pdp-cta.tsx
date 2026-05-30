"use client"

import { Price } from "@/components/currency/price"
import type { Locale } from "@/lib/locale"
import type { CartItem } from "@/lib/cart-store"

import { AddToCartButton } from "./add-to-cart-button"

type Props = {
  /** Built cart item for the current selection, or null when none is sellable. */
  item: CartItem | null
  priceFils: number
  locale: Locale
}

/**
 * Mobile-only (`md:hidden`) fixed bottom bar showing price + an Add-to-cart
 * button that mirrors the inline picker button. State is owned by the parent
 * `VariantPicker`, which passes the same `item` down so both buttons agree.
 */
export function StickyPdpCta({ item, priceFils, locale }: Props) {
  return (
    <div className="bg-background border-border fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-4 py-3 md:hidden">
      <span className="font-heading text-lg tracking-wide">
        <Price fils={priceFils} />
      </span>
      <AddToCartButton item={item} locale={locale} className="flex-1" />
    </div>
  )
}
