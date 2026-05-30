"use client"

import Image from "next/image"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Minus, Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import {
  MAX_QTY_PER_VARIANT,
  useCartStore,
  type CartItem,
} from "@/lib/cart-store"
import { Price } from "@/components/currency/price"
import type { Locale } from "@/lib/locale"

/**
 * A single cart line item: thumbnail, name + variant label, quantity stepper
 * (clamped to MAX_QTY_PER_VARIANT), line total, and a remove button.
 *
 * `compact` tightens spacing for the drawer; the full cart page uses the
 * roomier default.
 */
export function CartLineItem({
  item,
  compact = false,
}: {
  item: CartItem
  compact?: boolean
}) {
  const t = useTranslations("cart")
  const tCommon = useTranslations("common")
  const locale = useLocale() as Locale

  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const name = locale === "ar" ? item.nameAr : item.nameEn
  const colorName = locale === "ar" ? item.colorNameAr : item.colorNameEn
  const variantLabel = [colorName, item.size].filter(Boolean).join(" · ")
  const lineTotalFils = item.unitPriceFils * item.quantity

  const atMax = item.quantity >= MAX_QTY_PER_VARIANT

  function handleConfirmRemove() {
    remove(item.variantId)
    setConfirmOpen(false)
  }

  return (
    <div className="flex gap-3 py-4">
      <div
        className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${
          compact ? "size-16" : "size-20 sm:size-24"
        }`}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {name}
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={t("remove")}
            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        {variantLabel ? (
          <p className="text-xs text-muted-foreground">{variantLabel}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="inline-flex items-center rounded-md border border-border">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("decrease_qty")}
              onClick={() => setQuantity(item.variantId, item.quantity - 1)}
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </Button>
            <span
              className="min-w-6 text-center text-sm tabular-nums"
              aria-live="polite"
            >
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("increase_qty")}
              disabled={atMax}
              title={atMax ? t("max_qty_reached") : undefined}
              onClick={() => setQuantity(item.variantId, item.quantity + 1)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          <span className="text-sm font-semibold tabular-nums text-foreground">
            <Price fils={lineTotalFils} />
          </span>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("remove_confirm_title")}</DialogTitle>
            <DialogDescription>{t("remove_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemove}
            >
              {t("remove_confirm_action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
