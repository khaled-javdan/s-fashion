"use client"

import { useState } from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown, Loader2, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"

import { FreeShippingProgress } from "@/app/[locale]/(public)/checkout/free-shipping-progress"
import {
  selectItems,
  selectSavingsFils,
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
/** Coupon state + handlers, lifted to the checkout form so the order action
 *  can send the applied code. The component renders apply/remove UI + the
 *  discount line; pricing here is display-only (re-checked server-side). */
export type CouponUi = {
  /** Currently applied code (normalized), or null when none. */
  code: string | null
  /** Server-previewed discount in fils for the applied code. */
  discountFils: number
  /** True while applyCouponAction is in flight. */
  applying: boolean
  /** A tagged reason the last apply attempt failed, or null. */
  error: string | null
  onApply: (code: string) => void
  onRemove: () => void
}

export function OrderSummary({
  shippingConfig,
  country,
  coupon,
}: {
  shippingConfig: ShippingConfig
  country: CountryCode
  coupon?: CouponUi
}) {
  const t = useTranslations("checkout")
  const tShipping = useTranslations("shipping")
  const locale = useLocale() as Locale
  const [expanded, setExpanded] = useState(false)
  const [codeInput, setCodeInput] = useState("")

  const items = useCartStore(selectItems)
  const subtotalFils = useCartStore(selectSubtotalFils)
  const savingsFils = useCartStore(selectSavingsFils)

  const { shippingFils, freeThresholdFils, minDays, maxDays } = resolveShipping(
    shippingConfig,
    country,
    subtotalFils,
  )
  // Coupon discount is display-only here; the server recomputes + clamps it at
  // order time. Clamp locally too so the preview never shows a negative total.
  const discountFils = coupon?.code
    ? Math.min(coupon.discountFils, subtotalFils)
    : 0
  const totalFils = subtotalFils - discountFils + shippingFils

  const couponBlock = coupon ? (
    <div className="space-y-2">
      {coupon.code ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="text-muted-foreground">{t("coupon.label")}</span>
            <span className="font-mono uppercase tracking-wide" dir="ltr">
              {coupon.code}
            </span>
          </span>
          <button
            type="button"
            onClick={coupon.onRemove}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            <X className="size-3.5" aria-hidden="true" />
            {t("coupon.remove")}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-stretch gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (codeInput.trim()) coupon.onApply(codeInput.trim())
                }
              }}
              placeholder={t("coupon.placeholder")}
              aria-label={t("coupon.label")}
              autoCapitalize="characters"
              autoComplete="off"
              dir="ltr"
              className="h-9 uppercase"
              aria-invalid={!!coupon.error}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={coupon.applying || !codeInput.trim()}
              onClick={() => coupon.onApply(codeInput.trim())}
            >
              {coupon.applying ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                t("coupon.apply")
              )}
            </Button>
          </div>
          {coupon.error ? (
            <p className="text-destructive text-xs font-medium">
              {coupon.error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  ) : null

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
      {savingsFils > 0 ? (
        <div className="flex items-center justify-between font-medium text-emerald-600 dark:text-emerald-500">
          <span>{t("savings")}</span>
          <span dir="ltr" className="inline-flex items-center gap-0.5 tabular-nums">
            <span aria-hidden="true">−</span>
            <Price fils={savingsFils} />
          </span>
        </div>
      ) : null}
      {discountFils > 0 ? (
        <div className="flex items-center justify-between font-medium text-emerald-600 dark:text-emerald-500">
          <span>{t("coupon.discount")}</span>
          <span dir="ltr" className="inline-flex items-center gap-0.5 tabular-nums">
            <span aria-hidden="true">−</span>
            <Price fils={discountFils} />
          </span>
        </div>
      ) : null}
      <Separator className="my-1" />
      <div className="flex items-center justify-between text-base font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums"><Price fils={totalFils} /></span>
      </div>
      <p className="text-muted-foreground pt-1 text-xs">
        {tShipping("delivery_estimate", { minDays, maxDays })}
      </p>
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
        {couponBlock ? (
          <>
            {couponBlock}
            <Separator />
          </>
        ) : null}
        {totalsBlock}
      </div>
    </div>
  )
}
