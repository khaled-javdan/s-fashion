import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"

import { effectiveRate, parseCurrencyConfig } from "@/lib/currency-config"
import type { CurrencyCode } from "@/lib/currency"
import {
  DEFAULT_COUNTRY,
  SHIP_TO_COOKIE,
  currencyForCountry,
  isSupportedCountry,
  type CountryCode,
} from "@/lib/geo"
import { getSetting } from "@/lib/repos/settings.repo"
import { enabledCountries, parseShippingConfig } from "@/lib/shipping-config"

export type CurrencyContext = {
  /** Selected ship-to country (validated against the enabled set). */
  country: CountryCode
  /** Display currency derived from the country. */
  currency: CurrencyCode
  /** AED→currency rate for the display currency (1 for AED). */
  rate: number
  /** Countries currently offered to shoppers. */
  enabledCountries: CountryCode[]
}

/**
 * Resolve the active currency context for the current request from the
 * `ship_to` cookie + the `currency.config` / `shipping.countries` settings.
 * Memoised per-request with React `cache()` so the many product cards on a page
 * share a single settings read.
 */
export const getCurrencyContext = cache(async (): Promise<CurrencyContext> => {
  const [rawCurrency, rawShipping, cookieStore] = await Promise.all([
    getSetting("currency.config"),
    getSetting("shipping.countries"),
    cookies(),
  ])

  const config = parseCurrencyConfig(rawCurrency)
  const allowed = enabledCountries(parseShippingConfig(rawShipping))

  const cookieVal = cookieStore.get(SHIP_TO_COOKIE)?.value
  let country: CountryCode = DEFAULT_COUNTRY
  if (cookieVal && isSupportedCountry(cookieVal) && allowed.includes(cookieVal)) {
    country = cookieVal
  } else if (allowed.length > 0 && !allowed.includes(country)) {
    country = allowed[0]!
  }

  const currency = currencyForCountry(country)
  const rate = effectiveRate(config, currency)
  return { country, currency, rate, enabledCountries: allowed }
})
