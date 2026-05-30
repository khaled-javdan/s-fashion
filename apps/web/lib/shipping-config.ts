import { z } from "zod"

import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
  type CountryCode,
} from "@/lib/geo"

/**
 * Per-country shipping settings, stored as JSON under the `shipping.countries`
 * setting key. Each supported country has its own flat fee and free-shipping
 * threshold, both in **base AED fils** (converted for display like any other
 * money). Replaces the old single `shipping.flat_fils` /
 * `shipping.free_threshold_fils` pair.
 */
export type CountryShipping = {
  country: CountryCode
  enabled: boolean
  /** Flat shipping fee in base AED fils. */
  flatFils: number
  /** Subtotal (base AED fils) at/above which shipping is free. */
  freeThresholdFils: number
}

export type ShippingConfig = {
  countries: CountryShipping[]
}

const countryCode = z.enum(
  COUNTRY_CODES as unknown as [CountryCode, ...CountryCode[]],
)

export const countryShippingSchema = z.object({
  country: countryCode,
  enabled: z.boolean().default(true),
  flatFils: z.number().int().min(0),
  freeThresholdFils: z.number().int().min(0),
})

export const shippingConfigSchema = z.object({
  countries: z.array(countryShippingSchema).default([]),
})

/** GCC defaults. AE mirrors the previous single-country values (25 / 600 AED). */
export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  countries: [
    { country: "AE", enabled: true, flatFils: 2500, freeThresholdFils: 60000 },
    { country: "SA", enabled: true, flatFils: 5000, freeThresholdFils: 75000 },
    { country: "KW", enabled: true, flatFils: 6000, freeThresholdFils: 75000 },
    { country: "QA", enabled: true, flatFils: 6000, freeThresholdFils: 75000 },
    { country: "BH", enabled: true, flatFils: 6000, freeThresholdFils: 75000 },
    { country: "OM", enabled: true, flatFils: 6000, freeThresholdFils: 75000 },
  ],
}

/**
 * Parse a raw stored value into a ShippingConfig, merging defaults for any
 * supported country missing from the stored data so the admin form and checkout
 * always have a full row set to work with.
 */
export function parseShippingConfig(raw: unknown): ShippingConfig {
  const result = shippingConfigSchema.safeParse(raw)
  const stored = result.success ? result.data.countries : []
  const byCode = new Map(stored.map((c) => [c.country, c]))
  const countries = DEFAULT_SHIPPING_CONFIG.countries.map(
    (def) => byCode.get(def.country) ?? def,
  )
  return { countries }
}

/** Countries currently offered to shoppers (enabled rows, default order). */
export function enabledCountries(config: ShippingConfig): CountryCode[] {
  return config.countries.filter((c) => c.enabled).map((c) => c.country)
}

export type ResolvedShipping = {
  shippingFils: number
  freeThresholdFils: number
}

/**
 * Resolve shipping for a country + subtotal. Mirrors the original rule
 * (`subtotal >= threshold ? 0 : flat`). Falls back to the default country's row
 * when the requested country is missing/disabled.
 */
export function resolveShipping(
  config: ShippingConfig,
  country: string,
  subtotalFils: number,
): ResolvedShipping {
  const row =
    config.countries.find((c) => c.country === country && c.enabled) ??
    config.countries.find((c) => c.country === DEFAULT_COUNTRY) ??
    DEFAULT_SHIPPING_CONFIG.countries[0]!
  const { flatFils, freeThresholdFils } = row
  const shippingFils = subtotalFils >= freeThresholdFils ? 0 : flatFils
  return { shippingFils, freeThresholdFils }
}
