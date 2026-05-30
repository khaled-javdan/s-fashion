/**
 * Supported shipping countries (GCC to start) and their display currency.
 *
 * "Currency follows country": the shopper's selected country determines which
 * currency prices render in. UAE additionally uses the `Emirate` sub-region;
 * other countries collect a free-text city only.
 */

import { BASE_CURRENCY, type CurrencyCode } from "@/lib/currency"

/** ISO 3166-1 alpha-2 codes we ship to. */
export type CountryCode = "AE" | "SA" | "KW" | "QA" | "BH" | "OM"

export type SupportedCountry = {
  code: CountryCode
  currency: CurrencyCode
  /** Whether this country uses the UAE emirate sub-region select. */
  hasEmirates: boolean
}

export const SUPPORTED_COUNTRIES = [
  { code: "AE", currency: "AED", hasEmirates: true },
  { code: "SA", currency: "SAR", hasEmirates: false },
  { code: "KW", currency: "KWD", hasEmirates: false },
  { code: "QA", currency: "QAR", hasEmirates: false },
  { code: "BH", currency: "BHD", hasEmirates: false },
  { code: "OM", currency: "OMR", hasEmirates: false },
] as const satisfies readonly SupportedCountry[]

export const COUNTRY_CODES = [
  "AE",
  "SA",
  "KW",
  "QA",
  "BH",
  "OM",
] as const satisfies readonly CountryCode[]

export const DEFAULT_COUNTRY: CountryCode = "AE"

/** Cookie that stores the shopper's selected "ship to" country. */
export const SHIP_TO_COOKIE = "ship_to"

export function isSupportedCountry(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value)
}

export function countryForCode(code: string): SupportedCountry | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code)
}

/** Display currency for a country code; falls back to the base currency. */
export function currencyForCountry(code: string): CurrencyCode {
  return countryForCode(code)?.currency ?? BASE_CURRENCY
}

/** Whether the country uses the emirate sub-region (UAE only). */
export function countryHasEmirates(code: string): boolean {
  return countryForCode(code)?.hasEmirates ?? false
}
