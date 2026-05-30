import { z } from "zod"

import {
  BASE_CURRENCY,
  CURRENCY_CODES,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency"

/**
 * Admin-managed currency settings, stored as JSON under the `currency.config`
 * setting key. The admin enables currencies and enters a manual `AED → currency`
 * rate for each (no external FX feed). AED is always the base and always 1.
 */
export type CurrencyConfig = {
  /** Currencies offered to shoppers (AED always implicitly included). */
  enabled: CurrencyCode[]
  /** Manual AED→currency multipliers. AED is omitted (it is always 1). */
  rates: Partial<Record<CurrencyCode, number>>
}

const currencyCode = z.enum(CURRENCY_CODES)

export const currencyConfigSchema = z.object({
  enabled: z.array(currencyCode).default([BASE_CURRENCY]),
  // Keyed loosely as string→number then narrowed to known currencies in
  // `parseCurrencyConfig` (zod v4 would otherwise require an exhaustive record).
  rates: z.record(z.string(), z.number().positive().finite()).default({}),
})

/** Sensible GCC defaults (approximate; the admin tunes these). */
export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  enabled: ["AED", "SAR", "KWD", "QAR", "BHD", "OMR"],
  rates: {
    SAR: 1.02,
    KWD: 0.084,
    QAR: 0.99,
    BHD: 0.103,
    OMR: 0.105,
  },
}

/**
 * Parse a raw stored value into a CurrencyConfig, falling back to defaults.
 * Always guarantees the base currency (AED) is enabled.
 */
export function parseCurrencyConfig(raw: unknown): CurrencyConfig {
  const result = currencyConfigSchema.safeParse(raw)
  if (!result.success) return DEFAULT_CURRENCY_CONFIG
  const cfg = result.data
  const enabled = cfg.enabled.includes(BASE_CURRENCY)
    ? cfg.enabled
    : [BASE_CURRENCY, ...cfg.enabled]
  // Keep only known, non-base currency rates.
  const rates: Partial<Record<CurrencyCode, number>> = {}
  for (const [code, rate] of Object.entries(cfg.rates)) {
    if (isCurrencyCode(code) && code !== BASE_CURRENCY) rates[code] = rate
  }
  return { enabled, rates }
}

/** Effective AED→currency rate. Base currency (or anything missing) is 1. */
export function effectiveRate(
  config: CurrencyConfig,
  currency: CurrencyCode,
): number {
  if (currency === BASE_CURRENCY) return 1
  const rate = config.rates[currency]
  return typeof rate === "number" && rate > 0 ? rate : 1
}

/** Whether a currency is offered to shoppers. */
export function isCurrencyEnabled(
  config: CurrencyConfig,
  currency: CurrencyCode,
): boolean {
  return currency === BASE_CURRENCY || config.enabled.includes(currency)
}
