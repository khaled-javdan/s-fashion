/**
 * Money helpers.
 *
 * All monetary values flow through the system as integer **fils**
 * (1 AED = 100 fils). Floating-point AED is only ever used at the rendering
 * edge through {@link formatAed}.
 *
 * Conventions (see SPEC.md §3):
 * - DB columns and in-memory variables end in `Fils`.
 * - Never store, sum, or compare AED as a float.
 * - All public-facing formatting routes through this module so the currency
 *   symbol and numerals are locale-correct.
 */

import type { Locale } from "@/lib/locale"

const FILS_PER_AED = 100

/**
 * Convert an integer fils amount to AED as a plain number.
 * Intended for display arithmetic only — do not use as a storage type.
 */
export function filsToAed(fils: number): number {
  if (!Number.isFinite(fils)) {
    throw new TypeError(`filsToAed: expected a finite number, got ${fils}`)
  }
  return fils / FILS_PER_AED
}

/**
 * Convert an AED amount (number) to integer fils, rounded to the nearest fil.
 * Useful when reading user input. Server actions should still validate with Zod.
 */
export function aedToFils(aed: number): number {
  if (!Number.isFinite(aed)) {
    throw new TypeError(`aedToFils: expected a finite number, got ${aed}`)
  }
  return Math.round(aed * FILS_PER_AED)
}

/**
 * Format an integer fils amount as a locale-aware AED price string.
 *
 * - Arabic: uses Arabic-Indic digits and the AED symbol in Arabic order.
 * - English: uses Latin digits with the `AED` ISO code.
 *
 * Always renders exactly two fractional digits (cents).
 */
export function formatAed(fils: number, locale: Locale): string {
  const value = filsToAed(fils)
  const intlLocale = locale === "ar" ? "ar-AE" : "en-AE"
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
