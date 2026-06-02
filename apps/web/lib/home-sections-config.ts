import { z } from "zod"

/**
 * Home-page layout (the storefront's Shopify-style section organiser).
 *
 * Stored as JSON under the `home.sections` setting and edited from the admin
 * settings page. The hero banner is always pinned to the top and is NOT part of
 * this list. Everything else is an ordered list of blocks:
 *
 *  - **static** blocks are the unique storefront widgets (value props, shop-by
 *    tiles, testimonials, …). They're singletons — reorderable + show/hide, but
 *    not duplicable.
 *  - **product** blocks are admin-created product rows. The admin can add as many
 *    as they like (Best Sellers, New Arrivals, On Sale, …), each with a bilingual
 *    title, a catalogue `source` preset, an item limit, and an optional "See all"
 *    link override.
 */

/* ------------------------------------------------------------------ */
/* Static singleton sections                                           */
/* ------------------------------------------------------------------ */

export const STATIC_SECTION_KEYS = [
  "value_props",
  "shop_by",
  "track_order",
  "testimonials",
  "ugc_strip",
  "whatsapp_signup",
  "recently_viewed",
] as const

export type StaticSectionKey = (typeof STATIC_SECTION_KEYS)[number]

const STATIC_KEY_SET = new Set<string>(STATIC_SECTION_KEYS)

/* ------------------------------------------------------------------ */
/* Product-row sources                                                 */
/* ------------------------------------------------------------------ */

/** Catalogue presets a product row can draw from. */
export const PRODUCT_SOURCES = [
  "all",
  "newest",
  "best_selling",
  "on_sale",
  "in_stock",
] as const

export type ProductSource = (typeof PRODUCT_SOURCES)[number]

const SOURCE_SET = new Set<string>(PRODUCT_SOURCES)

/** The `/products` query string each source maps to ("" = unfiltered). */
const SOURCE_QUERY: Record<ProductSource, string> = {
  all: "",
  newest: "sort=newest",
  best_selling: "sort=best_selling",
  on_sale: "on_sale=1",
  in_stock: "in_stock=1",
}

/** Default "See all" target for a source — the products page, pre-filtered. */
export function productSourceHref(source: ProductSource): string {
  const q = SOURCE_QUERY[source]
  return q ? `/products?${q}` : "/products"
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export type StaticBlock = {
  type: "static"
  key: StaticSectionKey
  visible: boolean
  /**
   * Item cap for static widgets that render a list (see
   * {@link STATIC_SECTION_LIMITS}). Ignored by widgets that don't. Undefined →
   * the section default.
   */
  limit?: number
}

/**
 * Static singletons that render a capped list, with their default cap. A key
 * absent here ignores `limit` and shows no limit control in the admin form.
 */
export const STATIC_SECTION_LIMITS: Partial<Record<StaticSectionKey, number>> = {
  recently_viewed: 12,
}

/** Whether a static section supports an item limit. */
export function staticSectionSupportsLimit(key: StaticSectionKey): boolean {
  return key in STATIC_SECTION_LIMITS
}

/** Effective item cap for a static block (admin override over the default). */
export function staticBlockLimit(block: StaticBlock): number {
  return block.limit ?? STATIC_SECTION_LIMITS[block.key] ?? 12
}

export type ProductBlock = {
  type: "products"
  /** Stable id (used for React keys + the grid density storage scope). */
  id: string
  titleEn: string
  titleAr: string
  source: ProductSource
  /** Max products shown before the "See all" button. */
  limit: number
  /** Override for the "See all" link; empty → the source default. */
  ctaHref?: string
  visible: boolean
}

export type HomeBlock = StaticBlock | ProductBlock

export type HomeLayoutConfig = { blocks: HomeBlock[] }

/** The resolved "See all" href for a product block (override or source default). */
export function productBlockCtaHref(block: ProductBlock): string {
  return block.ctaHref?.trim() || productSourceHref(block.source)
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

/** The out-of-the-box layout: the previous fixed home page, expressed as blocks. */
export const DEFAULT_HOME_LAYOUT: HomeLayoutConfig = {
  blocks: [
    { type: "static", key: "value_props", visible: true },
    { type: "static", key: "shop_by", visible: true },
    { type: "static", key: "track_order", visible: true },
    {
      type: "products",
      id: "best-sellers",
      titleEn: "Best Sellers",
      titleAr: "الأكثر مبيعًا",
      source: "best_selling",
      limit: 8,
      visible: true,
    },
    { type: "static", key: "testimonials", visible: true },
    { type: "static", key: "ugc_strip", visible: true },
    { type: "static", key: "whatsapp_signup", visible: true },
    {
      type: "products",
      id: "new-arrivals",
      titleEn: "New Arrivals",
      titleAr: "وصل حديثًا",
      source: "newest",
      limit: 8,
      visible: true,
    },
    { type: "static", key: "recently_viewed", visible: true },
  ],
}

/** A fresh, blank product block for the admin "Add section" button. */
export function emptyProductBlock(id: string): ProductBlock {
  return {
    type: "products",
    id,
    titleEn: "",
    titleAr: "",
    source: "all",
    limit: 8,
    visible: true,
  }
}

/* ------------------------------------------------------------------ */
/* Schema + parsing                                                    */
/* ------------------------------------------------------------------ */

const staticBlockSchema = z.object({
  type: z.literal("static"),
  key: z.string(),
  visible: z.boolean().default(true),
  limit: z.number().int().min(1).max(48).optional(),
})

const productBlockSchema = z.object({
  type: z.literal("products"),
  id: z.string().min(1).max(64),
  titleEn: z.string().trim().max(60).default(""),
  titleAr: z.string().trim().max(60).default(""),
  source: z.string(),
  limit: z.number().int().min(1).max(48).default(8),
  ctaHref: z.string().trim().max(200).optional(),
  visible: z.boolean().default(true),
})

export const homeLayoutConfigSchema = z.object({
  blocks: z
    .array(z.discriminatedUnion("type", [staticBlockSchema, productBlockSchema]))
    .default([]),
})

/**
 * Migrate older stored shapes to the current `{ blocks }` model:
 *  - the interim `{ sections: [{ key, visible, limit?, ctaHref? }] }` shape maps
 *    the two product keys (best_sellers, product_grid) to product blocks and the
 *    rest to static blocks.
 *  - anything else falls through unchanged (validated/defaulted below).
 */
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.blocks)) return obj
  if (Array.isArray(obj.sections)) {
    const blocks = (obj.sections as Array<Record<string, unknown>>).map((s) => {
      const visible = s.visible !== false
      if (s.key === "best_sellers") {
        return {
          type: "products",
          id: "best-sellers",
          titleEn: "Best Sellers",
          titleAr: "الأكثر مبيعًا",
          source: "best_selling",
          limit: typeof s.limit === "number" ? s.limit : 8,
          ctaHref: typeof s.ctaHref === "string" ? s.ctaHref : undefined,
          visible,
        }
      }
      if (s.key === "product_grid") {
        return {
          type: "products",
          id: "new-arrivals",
          titleEn: "New Arrivals",
          titleAr: "وصل حديثًا",
          source: "newest",
          limit: typeof s.limit === "number" ? s.limit : 8,
          ctaHref: typeof s.ctaHref === "string" ? s.ctaHref : undefined,
          visible,
        }
      }
      return { type: "static", key: String(s.key), visible }
    })
    return { blocks }
  }
  return raw
}

/**
 * Parse a raw stored value into a clean layout:
 *  - drop unknown static keys + dedupe static singletons,
 *  - coerce unknown product sources to "all", dedupe product ids,
 *  - append any static singletons missing from storage (newly-added widgets) at
 *    the end so they always surface without wiping the admin's saved order.
 * Falls back to {@link DEFAULT_HOME_LAYOUT} when the value is unusable.
 */
export function parseHomeLayout(raw: unknown): HomeLayoutConfig {
  const parsed = homeLayoutConfigSchema.safeParse(migrate(raw ?? {}))
  if (!parsed.success || parsed.data.blocks.length === 0) {
    return DEFAULT_HOME_LAYOUT
  }

  const blocks: HomeBlock[] = []
  const seenStatic = new Set<string>()
  const seenIds = new Set<string>()

  for (const b of parsed.data.blocks) {
    if (b.type === "static") {
      if (STATIC_KEY_SET.has(b.key) && !seenStatic.has(b.key)) {
        seenStatic.add(b.key)
        blocks.push({
          type: "static",
          key: b.key as StaticSectionKey,
          visible: b.visible,
          ...(b.limit != null ? { limit: b.limit } : {}),
        })
      }
    } else {
      if (seenIds.has(b.id)) continue
      seenIds.add(b.id)
      blocks.push({
        type: "products",
        id: b.id,
        titleEn: b.titleEn,
        titleAr: b.titleAr,
        source: SOURCE_SET.has(b.source) ? (b.source as ProductSource) : "all",
        limit: b.limit,
        ...(b.ctaHref ? { ctaHref: b.ctaHref } : {}),
        visible: b.visible,
      })
    }
  }

  for (const key of STATIC_SECTION_KEYS) {
    if (!seenStatic.has(key)) {
      blocks.push({ type: "static", key, visible: true })
    }
  }

  return { blocks }
}
