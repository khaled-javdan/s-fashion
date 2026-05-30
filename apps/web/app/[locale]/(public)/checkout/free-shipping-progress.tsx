"use client"

import { useTranslations } from "next-intl"

import { useCurrency } from "@/components/providers/currency-provider"

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
  const { format } = useCurrency()

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
              amount: format(remainingFils),
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
