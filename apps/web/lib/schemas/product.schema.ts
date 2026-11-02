import { z } from "zod";
import { ProductKind, Size } from "@workspace/db/enums";
import type { ProductKind as ProductKindT, Size as SizeT } from "@workspace/db";
import { FABRIC_MATERIAL_KEYS } from "@/lib/fabric";

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
  // Shipping weight in grams. Required so every product contributes a real
  // weight to cart totals and per-kg shipping; `0` is allowed for genuinely
  // weightless items but the admin must enter it explicitly.
  weightGrams: z.number().int().min(0),
  // Per-product size chart override. `null` (the default) means the storefront
  // falls back to the global `size_chart.cm` setting.
  sizeChart: sizeChartSchema.nullish(),
  // GARMENT (colour × size) or FABRIC (fixed pre-cut piece, colour-only).
  kind: z.nativeEnum(ProductKind).default(ProductKind.GARMENT),
  // FABRIC-only descriptors; required when kind is FABRIC (see refineFabric).
  fabricMaterial: z.enum(FABRIC_MATERIAL_KEYS).nullish(),
  // Roll width in cm. 50–400 covers every realistic loom width.
  fabricWidthCm: z.number().int().min(50).max(400).nullish(),
  // Piece length in cm (300 = 3 m). 50 cm–50 m.
  fabricLengthCm: z.number().int().min(50).max(5000).nullish(),
  // Full replacement set of category ids. Omitted on update = leave untouched.
  categoryIds: z.array(z.string().min(1).max(64)).max(200).optional(),
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

/**
 * A FABRIC product must describe the piece (material, width, length) and its
 * variants are colour-only, so every variant must use size FREE. Only checked
 * when `kind` is present on the payload (always true for the admin form).
 */
function refineFabric(
  val: {
    kind?: ProductKindT;
    fabricMaterial?: string | null;
    fabricWidthCm?: number | null;
    fabricLengthCm?: number | null;
    variants?: { size: SizeT }[];
  },
  ctx: z.RefinementCtx,
): void {
  if (val.kind !== ProductKind.FABRIC) return;
  const required = [
    ["fabricMaterial", val.fabricMaterial, "Choose the fabric material."],
    ["fabricWidthCm", val.fabricWidthCm, "Enter the fabric width."],
    ["fabricLengthCm", val.fabricLengthCm, "Enter the piece length."],
  ] as const;
  for (const [path, value, message] of required) {
    if (value == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    }
  }
  if (val.variants?.some((v) => v.size !== Size.FREE)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variants"],
      message: "Fabric variants are colour-only (size must be FREE).",
    });
  }
}

export const productCreateSchema = productBase
  .extend({
    variants: z.array(productVariantSchema).min(1),
    images: z.array(productImageSchema).default([]),
  })
  .superRefine(refineCompareAt)
  .superRefine(refineFabric);
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/** Update allows partial top-level fields; variants/images supplied in full when present. */
export const productUpdateSchema = productBase
  .partial()
  .extend({
    variants: z.array(productVariantSchema).min(1).optional(),
    images: z.array(productImageSchema).optional(),
  })
  .superRefine(refineCompareAt)
  .superRefine(refineFabric);
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
