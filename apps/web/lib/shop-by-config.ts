import { z } from "zod"

/**
 * Configurable home "Shop by" tiles.
 *
 * Stored as JSON under the `home.shop_by` setting key (via the generic
 * `setSetting`/`getSetting` overloads — no schema change needed). Consumed by
 * the storefront `ShopBy` grid and edited from the admin settings page. Each
 * tile is an image + bilingual label that deep-links into the existing
 * `/products` listing with pre-applied filters (e.g. `/products?on_sale=1`).
 */

/** A single shop-by tile. `imageUrl` and `href` are required. */
export const shopByTileSchema = z.object({
  imageUrl: z.string().min(1),
  labelEn: z.string().trim().max(40).default(""),
  labelAr: z.string().trim().max(40).default(""),
  /**
   * Target path into the catalogue, e.g. "/products?on_sale=1". An internal
   * path starting with "/" — the query string is preserved as-is.
   */
  href: z.string().trim().min(1).max(200),
})

export type ShopByTile = z.infer<typeof shopByTileSchema>

export const shopByConfigSchema = z
  .object({
    /** When false, the storefront hides the shop-by grid entirely. */
    enabled: z.boolean().default(false),
    tiles: z.array(shopByTileSchema).max(8).default([]),
  })
  .refine((c) => !c.enabled || c.tiles.length > 0, {
    message: "Add at least one tile before enabling the shop-by grid.",
    path: ["tiles"],
  })

export type ShopByConfig = z.infer<typeof shopByConfigSchema>

export const DEFAULT_SHOP_BY: ShopByConfig = { enabled: false, tiles: [] }

export const EMPTY_TILE: ShopByTile = {
  imageUrl: "",
  labelEn: "",
  labelAr: "",
  href: "",
}

/**
 * Normalise a raw stored value into the current shape. Kept as a passthrough
 * (mirrors hero's `migrateHero`) so future shape changes have a single hook;
 * non-object input falls back to an empty, disabled config.
 */
function migrateShopBy(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.tiles)) return obj // already current shape
  return { enabled: obj.enabled ?? false, tiles: [] }
}

/** Parse a raw setting value into a ShopByConfig, falling back to defaults. */
export function parseShopByConfig(raw: unknown): ShopByConfig {
  const result = shopByConfigSchema.safeParse(migrateShopBy(raw ?? {}))
  return result.success ? result.data : DEFAULT_SHOP_BY
}

/**
 * Resolve the admin-entered tile path to a locale-aware URL while keeping any
 * query string intact.
 * - "#anchor"  → left as-is (same-page scroll)
 * - "/path?q"  → "/{locale}/path?q"
 * - ""         → "" (no target)
 */
export function resolveShopByHref(href: string, locale: string): string {
  if (!href) return ""
  if (href.startsWith("#")) return href
  if (href.startsWith("/")) return `/${locale}${href}`
  return href
}
