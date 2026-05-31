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
  strikethrough = false,
}: {
  fils: number
  locale: Locale
  currency: CurrencyCode
  rate: number
  className?: string
  /** Draw a strike line through the amount (e.g. an original/before price). */
  strikethrough?: boolean
}) {
  if (currency === BASE_CURRENCY) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          // `text-decoration: line-through` isn't painted across the atomic
          // inline-flex box or the SVG glyph, so draw the strike ourselves.
          strikethrough &&
            "relative before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-current before:content-['']",
          className,
        )}
      >
        <DirhamSign />
        <span>{formatAmount(fils, { locale, currency, rate })}</span>
      </span>
    )
  }
  return (
    <span className={cn(strikethrough && "line-through", className)}>
      {formatMoney(fils, { locale, currency, rate })}
    </span>
  )
}
