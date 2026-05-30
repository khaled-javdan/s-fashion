import { z } from "zod"

/**
 * Configurable home hero.
 *
 * Stored as JSON under the `home.hero` setting key (via the generic
 * `setSetting`/`getSetting` overloads — no schema change needed). Consumed by
 * the storefront `Hero` (rendered as a carousel) and edited from the admin
 * settings page. Supports any number of slides, each with its own image,
 * bilingual copy, and a call-to-action linking to an internal route.
 */

/** A single hero slide. `imageUrl` is required — a slide must have an image. */
export const heroSlideSchema = z.object({
  imageUrl: z.string().url(),
  eyebrowAr: z.string().trim().max(80).default(""),
  eyebrowEn: z.string().trim().max(80).default(""),
  headlineAr: z.string().trim().max(120).default(""),
  headlineEn: z.string().trim().max(120).default(""),
  subtextAr: z.string().trim().max(240).default(""),
  subtextEn: z.string().trim().max(240).default(""),
  ctaLabelAr: z.string().trim().max(40).default(""),
  ctaLabelEn: z.string().trim().max(40).default(""),
  /** Internal path only — "/products/slug", "/cart", or "#shop". */
  ctaHref: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || v.startsWith("/") || v.startsWith("#"),
      "Use an internal path starting with / or #, e.g. /products/abaya or #shop",
    )
    .default(""),
})

export type HeroSlideConfig = z.infer<typeof heroSlideSchema>

export const heroConfigSchema = z
  .object({
    /** When false, the storefront falls back to the product carousel. */
    enabled: z.boolean().default(false),
    slides: z.array(heroSlideSchema).max(10).default([]),
  })
  .refine((c) => !c.enabled || c.slides.length > 0, {
    message: "Add at least one slide before enabling the custom hero.",
    path: ["slides"],
  })

export type HeroConfig = z.infer<typeof heroConfigSchema>

export const DEFAULT_HERO: HeroConfig = { enabled: false, slides: [] }

export const EMPTY_SLIDE: HeroSlideConfig = {
  imageUrl: "",
  eyebrowAr: "",
  eyebrowEn: "",
  headlineAr: "",
  headlineEn: "",
  subtextAr: "",
  subtextEn: "",
  ctaLabelAr: "",
  ctaLabelEn: "",
  ctaHref: "",
}

/**
 * Normalise a raw stored value into the current multi-slide shape. Migrates the
 * older single-image config (`{ enabled, imageUrl, headlineEn, ... }`) into a
 * one-slide array so existing data keeps working.
 */
function migrateHero(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.slides)) return obj // already current shape
  if (typeof obj.imageUrl === "string" && obj.imageUrl) {
    const { enabled, imageUrl, ...rest } = obj
    return { enabled: enabled ?? false, slides: [{ imageUrl, ...rest }] }
  }
  return { enabled: obj.enabled ?? false, slides: [] }
}

/** Parse a raw setting value into a HeroConfig, falling back to defaults. */
export function parseHeroConfig(raw: unknown): HeroConfig {
  const result = heroConfigSchema.safeParse(migrateHero(raw ?? {}))
  return result.success ? result.data : DEFAULT_HERO
}

/**
 * Resolve the admin-entered CTA path to a locale-aware URL.
 * - "#anchor"  → left as-is (same-page scroll)
 * - "/path"    → "/{locale}/path"
 * - ""         → "" (no CTA)
 */
export function resolveHeroHref(href: string, locale: string): string {
  if (!href) return ""
  if (href.startsWith("#")) return href
  if (href.startsWith("/")) return `/${locale}${href}`
  return href
}
