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
  /**
   * Whether the free-shipping promo is offered at all. When `false`, the flat
   * fee (plus any weight surcharge) always applies and `freeThresholdFils` is
   * ignored — no order ever ships free, regardless of subtotal.
   */
  freeShippingEnabled: boolean
  /** Flat shipping fee in base AED fils. */
  flatFils: number
  /** Subtotal (base AED fils) at/above which shipping is free. */
  freeThresholdFils: number
  /**
   * Per-kilogram surcharge in base AED fils, applied to parcel weight ABOVE
   * `weightThresholdGrams`. `0` (the default) disables weight-based pricing.
   */
  perKgFils: number
  /**
   * Free weight allowance in grams. Parcel weight up to this is covered by the
   * flat fee; only the excess is billed at `perKgFils`. `0` means every gram is
   * charged once `perKgFils` is set.
   */
  weightThresholdGrams: number
  /** Lower bound of the estimated delivery window, in business days. */
  minDays: number
  /** Upper bound of the estimated delivery window, in business days. */
  maxDays: number
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
  /**
   * Optional in the stored shape so rows written before the toggle existed
   * still parse; they default to `true` (promo on), preserving prior behaviour.
   */
  freeShippingEnabled: z.boolean().default(true),
  flatFils: z.number().int().min(0),
  freeThresholdFils: z.number().int().min(0),
  /**
   * Weight-based surcharge. Optional in the stored shape so rows written before
   * weight pricing existed still parse; they default to `0` (feature off) and
   * `parseShippingConfig` leaves them as-is.
   */
  perKgFils: z.number().int().min(0).default(0),
  weightThresholdGrams: z.number().int().min(0).default(0),
  /**
   * Estimated delivery window, in business days. Optional in the stored shape
   * so rows written before delivery windows were modelled still parse;
   * `parseShippingConfig` backfills missing values from the country defaults.
   */
  minDays: z.number().int().min(0).max(60).optional(),
  maxDays: z.number().int().min(0).max(60).optional(),
})

export const shippingConfigSchema = z.object({
  countries: z.array(countryShippingSchema).default([]),
})

/** GCC defaults. AE mirrors the previous single-country values (25 / 600 AED). */
export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  countries: [
    {
      country: "AE",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 2500,
      freeThresholdFils: 60000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 1,
      maxDays: 3,
    },
    {
      country: "SA",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 5000,
      freeThresholdFils: 75000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 3,
      maxDays: 7,
    },
    {
      country: "KW",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 6000,
      freeThresholdFils: 75000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 3,
      maxDays: 7,
    },
    {
      country: "QA",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 6000,
      freeThresholdFils: 75000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 3,
      maxDays: 7,
    },
    {
      country: "BH",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 6000,
      freeThresholdFils: 75000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 3,
      maxDays: 7,
    },
    {
      country: "OM",
      enabled: true,
      freeShippingEnabled: true,
      flatFils: 6000,
      freeThresholdFils: 75000,
      perKgFils: 0,
      weightThresholdGrams: 0,
      minDays: 3,
      maxDays: 7,
    },
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
  const countries: CountryShipping[] = DEFAULT_SHIPPING_CONFIG.countries.map(
    (def) => {
      const row = byCode.get(def.country)
      if (!row) return def
      // Backfill delivery-window fields for rows stored before they existed.
      return {
        ...row,
        minDays: row.minDays ?? def.minDays,
        maxDays: row.maxDays ?? def.maxDays,
      }
    },
  )
  return { countries }
}

/** Countries currently offered to shoppers (enabled rows, default order). */
export function enabledCountries(config: ShippingConfig): CountryCode[] {
  return config.countries.filter((c) => c.enabled).map((c) => c.country)
}

export type ResolvedShipping = {
  shippingFils: number
  /**
   * The weight portion of `shippingFils` (base AED fils) — what the parcel's
   * excess weight added on top of the flat fee. `0` when under the free-weight
   * threshold or when the order ships free. Exposed for an optional breakdown
   * line; `shippingFils` is the authoritative amount charged.
   */
  weightSurchargeFils: number
  freeThresholdFils: number
  /**
   * Whether the free-shipping promo is offered for the resolved country. When
   * `false`, callers should hide all free-shipping messaging and never treat
   * `freeThresholdFils` as reachable.
   */
  freeShippingEnabled: boolean
  /** Estimated delivery window for the resolved country, in business days. */
  minDays: number
  maxDays: number
}

/** Per-kg surcharge for weight above the country's free allowance, in fils. */
function weightSurcharge(row: CountryShipping, totalWeightGrams: number): number {
  if (row.perKgFils <= 0) return 0
  const overweightGrams = Math.max(0, totalWeightGrams - row.weightThresholdGrams)
  if (overweightGrams <= 0) return 0
  return Math.round((overweightGrams / 1000) * row.perKgFils)
}

/**
 * Resolve shipping for a country + subtotal + total parcel weight. The fee is
 * the flat rate plus a per-kg surcharge on weight above the country's free
 * allowance; the whole fee is waived once `subtotal >= freeThreshold` (the
 * free-shipping promo covers heavy parcels too). Falls back to the default
 * country's row when the requested country is missing/disabled.
 */
export function resolveShipping(
  config: ShippingConfig,
  country: string,
  subtotalFils: number,
  totalWeightGrams = 0,
): ResolvedShipping {
  const fallback = DEFAULT_SHIPPING_CONFIG.countries[0]!
  const row =
    config.countries.find((c) => c.country === country && c.enabled) ??
    config.countries.find((c) => c.country === DEFAULT_COUNTRY) ??
    fallback
  const { flatFils, freeThresholdFils } = row
  // Rows stored before the toggle existed lack the field; treat missing as on.
  const freeShippingEnabled = row.freeShippingEnabled ?? true
  const free = freeShippingEnabled && subtotalFils >= freeThresholdFils
  const surchargeFils = weightSurcharge(row, totalWeightGrams)
  return {
    shippingFils: free ? 0 : flatFils + surchargeFils,
    weightSurchargeFils: free ? 0 : surchargeFils,
    freeThresholdFils,
    freeShippingEnabled,
    minDays: row.minDays ?? fallback.minDays,
    maxDays: row.maxDays ?? fallback.maxDays,
  }
}
