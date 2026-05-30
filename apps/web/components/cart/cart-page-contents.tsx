"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CartEmptyState } from "@/components/cart/cart-empty-state"
import { CartLineItem } from "@/components/cart/cart-line-item"
import {
  selectHasHydrated,
  selectItems,
  selectSubtotalFils,
  useCartStore,
} from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"

/**
 * Full cart page body. Mirrors the drawer content but laid out for a page:
 * a line-item list on the start side and a summary card on the end side
 * (stacked on mobile).
 *
 * Gated on `hasHydrated` so the server-rendered shell shows skeletons rather
 * than an incorrect empty/non-empty state before localStorage rehydrates.
 */
export function CartPageContents() {
  const t = useTranslations("cart")
  const locale = useLocale() as Locale

  const items = useCartStore(selectItems)
  const subtotalFils = useCartStore(selectSubtotalFils)
  const hasHydrated = useCartStore(selectHasHydrated)

  if (!hasHydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (items.length === 0) {
    return <CartEmptyState />
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="divide-y divide-border">
        {items.map((item) => (
          <CartLineItem key={item.variantId} item={item} />
        ))}
      </div>

      <aside className="h-fit rounded-lg border border-border bg-card p-6 lg:sticky lg:top-20">
        <h2 className="font-heading text-lg tracking-wide text-foreground">
          {t("subtotal")}
        </h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatAed(subtotalFils, locale)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("shipping_note")}
        </p>
        <Separator className="my-4" />
        <Button asChild className="w-full">
          <Link href={`/${locale}/checkout`}>{t("checkout")}</Link>
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href={`/${locale}`}>{t("continue_shopping")}</Link>
        </Button>
      </aside>
    </div>
  )
}
