import { cn } from "@workspace/ui/lib/utils"

import { DirhamSign } from "@/components/currency/dirham-sign"
import {
  BASE_CURRENCY,
  formatAmount,
  formatMoney,
  type CurrencyCode,
} from "@/lib/currency"
import type { Locale } from "@/lib/locale"

/**
 * Render a money amount with the correct currency presentation.
 *
 * For AED (the base currency) it shows the new Dirham SVG glyph followed by the
 * locale-formatted amount. For every other currency it falls back to the plain
 * {@link formatMoney} string (ISO code / Intl symbol).
 *
 * Pure presentational component (no hooks) so it works in both Server and Client
 * Components. Client call sites that read the active currency from context should
 * use {@link Price} instead.
 */
export function Money({
  fils,
  locale,
  currency,
  rate,
  className,
}: {
  fils: number
  locale: Locale
  currency: CurrencyCode
  rate: number
  className?: string
}) {
  if (currency === BASE_CURRENCY) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <DirhamSign />
        <span>{formatAmount(fils, { locale, currency, rate })}</span>
      </span>
    )
  }
  return (
    <span className={className}>
      {formatMoney(fils, { locale, currency, rate })}
    </span>
  )
}
