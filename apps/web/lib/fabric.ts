/**
 * Fabric products — client-safe helpers (no Prisma import).
 *
 * A FABRIC product is sold as a fixed pre-cut piece (e.g. 3 m × 147 cm, enough
 * for one dress) at a fixed per-piece price. Its variants are colour-only and
 * always carry size `FREE`; what the customer receives is described by the
 * product's `fabricMaterial`, `fabricWidthCm` and `fabricLengthCm`.
 */

import type { Locale } from "@/lib/locale"

/** Size every fabric variant is stored with (fabric has no garment sizes). */
export const FABRIC_VARIANT_SIZE = "FREE" as const

/** Curated material list. Keys are persisted on `Product.fabricMaterial`. */
export const FABRIC_MATERIALS = [
  { key: "silk", en: "Silk", ar: "حرير" },
  { key: "cotton", en: "Cotton", ar: "قطن" },
  { key: "cotton_silk", en: "Cotton silk", ar: "قطن حرير" },
  { key: "linen", en: "Linen", ar: "كتان" },
  { key: "viscose", en: "Viscose", ar: "فيسكوز" },
  { key: "chiffon", en: "Chiffon", ar: "شيفون" },
  { key: "georgette", en: "Georgette", ar: "جورجيت" },
  { key: "crepe", en: "Crepe", ar: "كريب" },
  { key: "satin", en: "Satin", ar: "ساتان" },
  { key: "organza", en: "Organza", ar: "أورجانزا" },
  { key: "tulle", en: "Tulle", ar: "تول" },
  { key: "velvet", en: "Velvet", ar: "مخمل" },
  { key: "lace", en: "Lace", ar: "دانتيل" },
  { key: "other", en: "Other", ar: "أخرى" },
] as const

export type FabricMaterialKey = (typeof FABRIC_MATERIALS)[number]["key"]

export const FABRIC_MATERIAL_KEYS = FABRIC_MATERIALS.map(
  (m) => m.key,
) as unknown as readonly [FabricMaterialKey, ...FabricMaterialKey[]]

export function isFabricMaterialKey(v: string): v is FabricMaterialKey {
  return (FABRIC_MATERIAL_KEYS as readonly string[]).includes(v)
}

/** Localized material name, or `null` for an unknown/absent key. */
export function fabricMaterialLabel(
  key: string | null | undefined,
  locale: Locale,
): string | null {
  const m = FABRIC_MATERIALS.find((x) => x.key === key)
  return m ? m[locale] : null
}

/** Common roll widths offered as quick picks in the admin (cm). */
export const COMMON_FABRIC_WIDTHS_CM = [110, 140, 147, 150] as const

function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    maximumFractionDigits: 2,
  }).format(n)
}

/** 300 → "3 m" / "3 م"; 350 → "3.5 m". */
export function formatFabricLength(cm: number, locale: Locale): string {
  return `${formatNumber(cm / 100, locale)} ${locale === "ar" ? "م" : "m"}`
}

/** 147 → "147 cm" / "147 سم". */
export function formatFabricWidth(cm: number, locale: Locale): string {
  return `${formatNumber(cm, locale)} ${locale === "ar" ? "سم" : "cm"}`
}

/** Short label for a cart/order line: "3 m piece" / "قطعة 3 م". */
export function pieceLabel(cm: number, locale: Locale): string {
  const len = formatFabricLength(cm, locale)
  return locale === "ar" ? `قطعة ${len}` : `${len} piece`
}

/**
 * The size part of a variant label. Fabric lines (with a piece length) read
 * "3 m piece"; garments show their size as before.
 */
export function lineSizeLabel(
  line: { size: string; pieceLengthCm?: number | null },
  locale: Locale,
): string {
  return line.pieceLengthCm ? pieceLabel(line.pieceLengthCm, locale) : line.size
}

/** "Colour · Size" (or "Colour · 3 m piece") for cart/order lines. */
export function lineVariantLabel(
  line: {
    colorNameAr?: string | null
    colorNameEn?: string | null
    size: string
    pieceLengthCm?: number | null
  },
  locale: Locale,
): string {
  const color = locale === "ar" ? line.colorNameAr : line.colorNameEn
  return [color, lineSizeLabel(line, locale)].filter(Boolean).join(" · ")
}
