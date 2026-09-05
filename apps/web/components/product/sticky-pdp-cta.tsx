"use client"

import { cn } from "@workspace/ui/lib/utils"

import { Price } from "@/components/currency/price"
import type { Locale } from "@/lib/locale"
import type { CartItem } from "@/lib/cart-store"
import { stockLevel } from "@/lib/stock-urgency"

import { AddToCartButton } from "./add-to-cart-button"

type Props = {
  /** Built cart item for the current selection, or null when none is sellable. */
  item: CartItem | null
  priceFils: number
  locale: Locale
  /** Stock of the selected variant (0 when nothing is selected yet). */
  stock: number
  /** Pre-translated "Only N left" for the selected variant. */
  lowStockLabel: string
}

/**
 * Mobile-only (`md:hidden`) fixed bottom bar showing price + an Add-to-cart
 * button that mirrors the inline picker button. State is owned by the parent
 * `VariantPicker`, which passes the same `item` down so both buttons agree.
 *
 * When the selected variant is running low, a slim urgency strip slides in
 * above the bar. On mobile the inline stock badge is usually scrolled out of
 * view by the time the shopper reaches the CTA, so this is the only place the
 * count is visible at the moment of decision.
 */
export function StickyPdpCta({
  item,
  priceFils,
  locale,
  stock,
  lowStockLabel,
}: Props) {
  const level = stockLevel(stock)
  const urgent = level === "critical" || level === "low"

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 md:hidden">
      {urgent ? (
        <div
          className={cn(
            "animate-in fade-in slide-in-from-bottom-2 flex items-center justify-center gap-2 px-4 py-1 text-[11px] font-semibold duration-500",
            level === "critical"
              ? "bg-destructive text-destructive-foreground"
              : "bg-accent text-accent-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "animate-urgency-throb size-1.5 rounded-full",
              level === "critical"
                ? "bg-destructive-foreground"
                : "bg-destructive",
            )}
          />
          <span className="tabular-nums">{lowStockLabel}</span>
        </div>
      ) : null}

      <div className="bg-background border-border flex items-center gap-3 border-t px-4 py-3">
        <span className="font-heading text-lg tracking-wide">
          <Price fils={priceFils} />
        </span>
        <AddToCartButton item={item} locale={locale} className="flex-1" />
      </div>
    </div>
  )
}
