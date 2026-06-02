import { z } from "zod";
import { Size } from "@workspace/db/enums";

/** Hex color, 3 or 6 digits, leading #. */
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u, "must be a hex color, e.g. #C97B84");

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** A single variant attached to a product. */
export const productVariantSchema = z.object({
  // optional on create so existing-variant edits and brand-new variants share the schema
  id: z.string().min(1).optional(),
  colorNameAr: z.string().trim().min(1).max(60).nullish(),
  colorNameEn: z.string().trim().min(1).max(60).nullish(),
  colorHex: hexColor.nullish(),
  size: z.nativeEnum(Size),
  stock: z.number().int().min(0),
  sku: z.string().trim().min(1).max(64).nullish(),
});
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

/**
 * A single size-chart row. `shoulder`, `bust`, `waist`, `hips`, `sleeves` are
 * optional measurements; `length` is required. Stored as numbers in the unit
 * declared on the chart (decimals allowed — inches commonly land on `.5`).
 */
export const sizeChartRowSchema = z.object({
  size: z.string().trim().min(1).max(20),
  // `.default(null)` so legacy rows missing the new fields parse cleanly with
  // an explicit `null`, avoiding a `field-or-undefined` consumer surface.
  shoulder: z.number().min(0).nullable().default(null),
  bust: z.number().min(0).nullable(),
  waist: z.number().min(0).nullable(),
  hips: z.number().min(0).nullable(),
  sleeves: z.number().min(0).nullable().default(null),
  length: z.number().min(0),
});
export type SizeChartRowInput = z.infer<typeof sizeChartRowSchema>;

/**
 * Per-product size chart override. `null` means "use the global default". When
 * present, `unit` is the unit the row numbers are stored in — defaults to
 * inches for new charts; `"cm"` is preserved for legacy data and admins who
 * prefer it.
 */
export const sizeChartSchema = z.object({
  unit: z.enum(["in", "cm"]).default("in"),
  rows: z.array(sizeChartRowSchema).min(1),
});
export type SizeChartInput = z.infer<typeof sizeChartSchema>;

/** A product image. */
export const productImageSchema = z.object({
  id: z.string().min(1).optional(),
  url: z.string().url(),
  altAr: z.string().trim().max(200).nullish(),
  altEn: z.string().trim().max(200).nullish(),
  /** Color this photo depicts, matched to a variant's colorHex (optional). */
  colorHex: hexColor.nullish(),
  position: z.number().int().min(0).default(0),
});
export type ProductImageInput = z.infer<typeof productImageSchema>;

/** Shared product fields (used by both create and update). */
const productBase = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(slugRegex, "lowercase, digits, and dashes only"),
  nameAr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  // Rich-text (HTML) fields — the markup the editor emits inflates length well
  // beyond the visible character count, so the cap is generous.
  descAr: z.string().trim().max(20000).nullish(),
  descEn: z.string().trim().max(20000).nullish(),
  additionalInfoAr: z.string().trim().max(20000).nullish(),
  additionalInfoEn: z.string().trim().max(20000).nullish(),
  priceFils: z.number().int().min(0),
  compareAtFils: z.number().int().min(0).nullish(),
  costPriceFils: z.number().int().min(0),
  isActive: z.boolean().default(true),
  isFinalSale: z.boolean().default(false),
  // Shipping weight in grams. Optional; `null` (the default) means the product
  // adds nothing to the cart weight and never triggers a per-kg surcharge.
  weightGrams: z.number().int().min(0).nullish(),
  // Per-product size chart override. `null` (the default) means the storefront
  // falls back to the global `size_chart.cm` setting.
  sizeChart: sizeChartSchema.nullish(),
});

/**
 * A compare-at ("was") price only makes sense when it's strictly higher than
 * the live price — otherwise the storefront renders a zero/negative discount.
 * Applied to both create and update (update only checks when both are present).
 */
function refineCompareAt(
  val: { priceFils?: number; compareAtFils?: number | null },
  ctx: z.RefinementCtx,
): void {
  if (
    val.compareAtFils != null &&
    val.priceFils != null &&
    val.compareAtFils <= val.priceFils
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compareAtFils"],
      message: "Compare-at price must be greater than the price.",
    });
  }
}

export const productCreateSchema = productBase
  .extend({
    variants: z.array(productVariantSchema).min(1),
    images: z.array(productImageSchema).default([]),
  })
  .superRefine(refineCompareAt);
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/** Update allows partial top-level fields; variants/images supplied in full when present. */
export const productUpdateSchema = productBase
  .partial()
  .extend({
    variants: z.array(productVariantSchema).min(1).optional(),
    images: z.array(productImageSchema).optional(),
  })
  .superRefine(refineCompareAt);
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
