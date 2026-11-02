import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Create/update payload for a category (names + slug + visibility). */
export const categoryWriteSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(slugRegex, "lowercase, digits, and dashes only"),
  nameEn: z.string().trim().min(1).max(80),
  nameAr: z.string().trim().min(1).max(80),
  isActive: z.boolean().default(true),
});
export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>;
export type CategoryWriteSchemaInput = z.input<typeof categoryWriteSchema>;

/** A full replacement set of ids (products of a category, or categories of a product). */
export const idListSchema = z.array(z.string().min(1).max(64)).max(5000);
