import { z } from "zod"

/**
 * Allow-listed structured-output schemas for image analysis.
 *
 * The client never sends a Zod schema — it sends a *key* (e.g.
 * `"product-suggestions-v1"`). The server resolves that key to one of the
 * schemas registered here before handing it to `generateObject`. This keeps
 * untrusted client input from ever shaping the model's output contract.
 *
 * Every field is optional: the model is instructed to leave a field empty
 * when it genuinely cannot infer the value from the image.
 */

export const productSuggestionsSchemaV1 = z.object({
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
  descEn: z.string().optional(),
  descAr: z.string().optional(),
  colorNameEn: z.string().optional(),
  colorNameAr: z.string().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  slug: z.string().optional(),
  altEn: z.string().optional(),
  altAr: z.string().optional(),
  occasionTags: z.array(z.string()).optional(),
})

/**
 * v2 — product suggestions across one or MORE images. Product-level copy stays
 * flat; colour is expressed as a `variants` array with one entry per image (in
 * the same order), so multi-image products get one colour variant per photo.
 */
export const productSuggestionsSchemaV2 = z.object({
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
  descEn: z.string().optional(),
  descAr: z.string().optional(),
  slug: z.string().optional(),
  variants: z
    .array(
      z.object({
        colorNameEn: z.string().optional(),
        colorNameAr: z.string().optional(),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .optional(),
})

// Field names mirror HeroSlideConfig (lib/hero-config.ts) so suggestions apply
// straight onto the slide draft with no remapping.
export const heroSlideSuggestionsSchemaV1 = z.object({
  eyebrowEn: z.string().optional(),
  eyebrowAr: z.string().optional(),
  headlineEn: z.string().optional(),
  headlineAr: z.string().optional(),
  subtextEn: z.string().optional(),
  subtextAr: z.string().optional(),
  ctaLabelEn: z.string().optional(),
  ctaLabelAr: z.string().optional(),
})

export const SCHEMA_REGISTRY = {
  "product-suggestions-v1": productSuggestionsSchemaV1,
  "product-suggestions-v2": productSuggestionsSchemaV2,
  "hero-slide-suggestions-v1": heroSlideSuggestionsSchemaV1,
} as const

export type SchemaKey = keyof typeof SCHEMA_REGISTRY

/** Stable version tag mixed into the cache key so schema changes bust the cache. */
export const SCHEMA_VERSION = "v1"

export function isSchemaKey(value: unknown): value is SchemaKey {
  return typeof value === "string" && value in SCHEMA_REGISTRY
}

export function getSchema(key: SchemaKey) {
  return SCHEMA_REGISTRY[key]
}
