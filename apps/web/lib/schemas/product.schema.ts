import { z } from "zod";
import { Size } from "@workspace/db";

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
  descAr: z.string().trim().max(4000).nullish(),
  descEn: z.string().trim().max(4000).nullish(),
  priceFils: z.number().int().min(0),
  compareAtFils: z.number().int().min(0).nullish(),
  isActive: z.boolean().default(true),
  isFinalSale: z.boolean().default(false),
});

export const productCreateSchema = productBase.extend({
  variants: z.array(productVariantSchema).min(1),
  images: z.array(productImageSchema).default([]),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/** Update allows partial top-level fields; variants/images supplied in full when present. */
export const productUpdateSchema = productBase.partial().extend({
  variants: z.array(productVariantSchema).min(1).optional(),
  images: z.array(productImageSchema).optional(),
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
