"use client"

import { useLocale, useTranslations } from "next-intl"

import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"

/**
 * Free-shipping nudge. Shows a progress bar toward the free-shipping
 * threshold and either how much more to spend or an "unlocked" message.
 */
export function FreeShippingProgress({
  subtotalFils,
  thresholdFils,
}: {
  subtotalFils: number
  thresholdFils: number
}) {
  const t = useTranslations("checkout")
  const locale = useLocale() as Locale

  if (thresholdFils <= 0) return null

  const unlocked = subtotalFils >= thresholdFils
  const remainingFils = Math.max(0, thresholdFils - subtotalFils)
  const pct = Math.min(100, Math.round((subtotalFils / thresholdFils) * 100))

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {unlocked
          ? t("free_shipping_unlocked")
          : t("free_shipping_remaining", {
              amount: formatAed(remainingFils, locale),
            })}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
