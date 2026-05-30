"use client"

import { useLocale } from "next-intl"

import { Money } from "@/components/currency/money"
import { useCurrency } from "@/components/providers/currency-provider"
import type { Locale } from "@/lib/locale"

/**
 * Client-side price display. Reads the active ship-to currency + rate from the
 * {@link useCurrency} context and renders {@link Money} (Dirham glyph for AED,
 * ISO formatting otherwise). Use this in Client Components; Server Components
 * render {@link Money} directly with currency/rate from `getCurrencyContext()`.
 */
export function Price({
  fils,
  className,
}: {
  fils: number
  className?: string
}) {
  const locale = useLocale() as Locale
  const { currency, rate } = useCurrency()
  return (
    <Money
      fils={fils}
      locale={locale}
      currency={currency}
      rate={rate}
      className={className}
    />
  )
}
