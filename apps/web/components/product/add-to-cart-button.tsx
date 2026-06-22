"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"

import { addToCart } from "@/lib/analytics/data-layer"
import type { Locale } from "@/lib/locale"
import { type CartItem, useCartStore } from "@/lib/cart-store"

/**
 * Documented cart-store mutation surface (Track F implements it). We consume it
 * through this minimal contract so this track typechecks against the public
 * interface in `cart-store.ts`'s TSDoc without importing internal wiring.
 */
type CartMutations = {
  add(item: CartItem): void
}

type Props = {
  /** Fully-built cart item, or null while no in-stock variant is selected. */
  item: CartItem | null
  locale: Locale
  /** Optional extra classes (e.g. full-width on the sticky CTA). */
  className?: string
}

/**
 * Adds the selected variant to the cart via the documented store interface
 * (`useCartStore.getState().add`). Fires a sonner toast with a "View cart"
 * action. Never navigates away. Disabled until a sellable variant is selected.
 *
 * Note: the `<Toaster />` mount is owned by Track F. Until it lands, toasts
 * silently no-op — intentional and acceptable.
 */
export function AddToCartButton({ item, locale, className }: Props) {
  const t = useTranslations("product")

  function handleClick() {
    if (!item) return
    // Consume the documented public mutation surface (Track F implements `add`).
    const store = useCartStore.getState() as unknown as CartMutations
    store.add(item)
    // GA4 add_to_cart → dataLayer (GTM fans out). Variant-level: item_id = variantId.
    addToCart({
      variantId: item.variantId,
      nameEn: item.nameEn,
      unitPriceFils: item.unitPriceFils,
      quantity: item.quantity,
    })
    // `<Toaster />` mount is owned by Track F; if not mounted yet, this no-ops.
    toast.success(t("added_to_cart_toast"), {
      action: {
        label: t("view_cart_action"),
        onClick: () => {
          window.location.href = `/${locale}/cart`
        },
      },
    })
  }

  return (
    <Button
      type="button"
      size="lg"
      disabled={!item}
      onClick={handleClick}
      className={className}
    >
      {t("add_to_cart")}
    </Button>
  )
}
