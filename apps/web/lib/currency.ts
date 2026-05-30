/**
 * Multi-currency display layer.
 *
 * The store keeps a single source of truth for money: integer **AED fils**
 * (1 AED = 100 fils). Other currencies are *display-only* — a base-AED amount is
 * converted with an admin-entered rate and formatted at the rendering edge. We
 * never store, sum, or compare non-AED money.
 *
 * Conversion: `majorAed = fils / 100` → `display = majorAed * rate` → format with
 * `Intl.NumberFormat`, which applies the correct fraction digits per currency
 * (AED/SAR/QAR → 2, KWD/BHD/OMR → 3).
 */

import type { Locale } from "@/lib/locale"

/** Currencies we support for display (GCC). AED is the base. */
export type CurrencyCode = "AED" | "SAR" | "KWD" | "QAR" | "BHD" | "OMR"

export const CURRENCY_CODES = [
  "AED",
  "SAR",
  "KWD",
  "QAR",
  "BHD",
  "OMR",
] as const satisfies readonly CurrencyCode[]

/** The single stored currency. fils are 1/100 of one AED. */
export const BASE_CURRENCY: CurrencyCode = "AED"

const FILS_PER_AED = 100

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value)
}

/**
 * Convert an integer base-AED fils amount to a major-unit amount in the target
 * currency using the supplied AED→currency rate. Display arithmetic only.
 */
export function convertFils(fils: number, rate: number): number {
  if (!Number.isFinite(fils)) {
    throw new TypeError(`convertFils: expected finite fils, got ${fils}`)
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new TypeError(`convertFils: expected positive rate, got ${rate}`)
  }
  return (fils / FILS_PER_AED) * rate
}

export type FormatMoneyOptions = {
  locale: Locale
  currency: CurrencyCode
  /** AED→currency multiplier. Use 1 for AED (the base). */
  rate: number
}

/**
 * Format an integer base-AED fils amount as a locale-aware currency string.
 * - Arabic uses Arabic-Indic digits; English uses Latin digits.
 * - Fraction digits follow the currency's ISO definition (Intl default).
 */
export function formatMoney(
  fils: number,
  { locale, currency, rate }: FormatMoneyOptions,
): string {
  const value = convertFils(fils, rate)
  const intlLocale = locale === "ar" ? "ar" : "en"
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
  }).format(value)
}

/** ISO fraction digits for a currency (AED/SAR/QAR → 2, KWD/BHD/OMR → 3). */
function currencyFractionDigits(currency: CurrencyCode): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  )
}

/**
 * Format just the numeric part of a money amount (grouping + currency-correct
 * fraction digits, locale-aware digits) with **no** currency symbol. Used by the
 * {@link Money} component, which renders its own symbol (e.g. the Dirham glyph).
 */
export function formatAmount(
  fils: number,
  { locale, currency, rate }: FormatMoneyOptions,
): string {
  const value = convertFils(fils, rate)
  const intlLocale = locale === "ar" ? "ar" : "en"
  const digits = currencyFractionDigits(currency)
  return new Intl.NumberFormat(intlLocale, {
    style: "decimal",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
