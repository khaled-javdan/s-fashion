"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@workspace/ui/components/sheet"

import { CartEmptyState } from "@/components/cart/cart-empty-state"
import { CartLineItem } from "@/components/cart/cart-line-item"
import {
  selectItems,
  selectSubtotalFils,
  useCartStore,
} from "@/lib/cart-store"
import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"

/**
 * Cart drawer body, rendered inside the header's `<Sheet>` (opens from the
 * inline-end side). Lists line items, shows the subtotal, and links to the
 * full cart page + checkout. `onClose` is forwarded so navigation closes the
 * sheet.
 */
export function CartDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("cart")
  const locale = useLocale() as Locale

  const items = useCartStore(selectItems)
  const subtotalFils = useCartStore(selectSubtotalFils)

  const isEmpty = items.length === 0

  // The shared Sheet positions content with physical sides. Map the active
  // locale's inline-end edge to the matching physical side so the drawer
  // always slides in from the trailing edge (RTL → left, LTR → right).
  const side = locale === "ar" ? "left" : "right"

  return (
    <SheetContent side={side} className="w-full gap-0 p-0 sm:max-w-md">
      <SheetHeader className="border-b border-border p-6">
        <SheetTitle>{t("drawer_title")}</SheetTitle>
      </SheetHeader>

      {isEmpty ? (
        <div className="flex-1 overflow-y-auto">
          <CartEmptyState onNavigate={onClose} />
        </div>
      ) : (
        <>
          <div className="flex-1 divide-y divide-border overflow-y-auto px-6">
            {items.map((item) => (
              <CartLineItem key={item.variantId} item={item} compact />
            ))}
          </div>

          <SheetFooter className="border-t border-border p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatAed(subtotalFils, locale)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("shipping_note")}</p>
            <Separator className="my-1" />
            <Button asChild className="w-full">
              <Link href={`/${locale}/checkout`} onClick={onClose}>
                {t("checkout")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${locale}/cart`} onClick={onClose}>
                {t("view_full_cart")}
              </Link>
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}
