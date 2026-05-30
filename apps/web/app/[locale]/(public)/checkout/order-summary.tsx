"use client"

import { useState } from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"

import { Separator } from "@workspace/ui/components/separator"

import { FreeShippingProgress } from "@/app/[locale]/(public)/checkout/free-shipping-progress"
import {
  selectItems,
  selectSubtotalFils,
  useCartStore,
} from "@/lib/cart-store"
import type { CountryCode } from "@/lib/geo"
import type { Locale } from "@/lib/locale"
import { resolveShipping, type ShippingConfig } from "@/lib/shipping-config"
import { Price } from "@/components/currency/price"

/**
 * Sticky order summary (desktop) / collapsible summary (mobile).
 *
 * Pricing is display-only here — the authoritative figures are recomputed
 * server-side at order creation. We mirror the same rule (free over threshold)
 * so the customer sees a consistent total.
 */
export function OrderSummary({
  shippingConfig,
  country,
}: {
  shippingConfig: ShippingConfig
  country: CountryCode
}) {
  const t = useTranslations("checkout")
  const locale = useLocale() as Locale
  const [expanded, setExpanded] = useState(false)

  const items = useCartStore(selectItems)
  const subtotalFils = useCartStore(selectSubtotalFils)

  const { shippingFils, freeThresholdFils } = resolveShipping(
    shippingConfig,
    country,
    subtotalFils,
  )
  const totalFils = subtotalFils + shippingFils

  const totalsBlock = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{t("subtotal")}</span>
        <span className="tabular-nums"><Price fils={subtotalFils} /></span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{t("shipping_fee")}</span>
        <span className="tabular-nums">
          {shippingFils === 0
            ? t("shipping_free")
            : <Price fils={shippingFils} />}
        </span>
      </div>
      <Separator className="my-1" />
      <div className="flex items-center justify-between text-base font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums"><Price fils={totalFils} /></span>
      </div>
    </div>
  )

  const itemsBlock = (
    <ul className="space-y-3">
      {items.map((item) => {
        const name = locale === "ar" ? item.nameAr : item.nameEn
        const colorName =
          locale === "ar" ? item.colorNameAr : item.colorNameEn
        const variantLabel = [colorName, item.size]
          .filter(Boolean)
          .join(" · ")
        return (
          <li key={item.variantId} className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : null}
              <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{name}</p>
              {variantLabel ? (
                <p className="text-xs text-muted-foreground">{variantLabel}</p>
              ) : null}
            </div>
            <span className="text-sm tabular-nums">
              <Price fils={item.unitPriceFils * item.quantity} />
            </span>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Mobile: collapsible header showing the total. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 p-4 text-sm lg:hidden"
      >
        <span className="flex items-center gap-1.5 font-medium">
          {expanded ? t("hide_summary") : t("show_summary")}
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
        <span className="font-semibold tabular-nums">
          <Price fils={totalFils} />
        </span>
      </button>

      <div
        className={`space-y-4 px-4 pb-4 lg:block lg:p-6 ${expanded ? "block" : "hidden"}`}
      >
        <h2 className="hidden font-heading text-lg tracking-wide text-foreground lg:block">
          {t("order_summary")}
        </h2>
        {itemsBlock}
        <Separator />
        <FreeShippingProgress
          subtotalFils={subtotalFils}
          thresholdFils={freeThresholdFils}
        />
        {totalsBlock}
      </div>
    </div>
  )
}
