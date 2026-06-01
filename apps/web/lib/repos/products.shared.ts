// Client-safe product helpers and types. This module must NOT import `prisma`
// (or anything from `@workspace/db` other than types), so that client
// components can import the pure helpers below without pulling the server-only
// Prisma client — and its Node built-ins like `node:fs` — into the browser
// bundle. The server-side repo (`products.repo.ts`) re-exports these.
import type { Product, ProductVariant, ProductImage } from "@workspace/db";

import { sizeChartSchema, type SizeChartRowInput } from "@/lib/schemas/product.schema";

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

/**
 * Parse a product's stored `sizeChart` JSON into validated rows, or `null` when
 * the product has no override (and the storefront should fall back to the
 * global `size_chart.cm` setting). Malformed JSON is treated as no override.
 */
export function parseProductSizeChartRows(
  value: Product["sizeChart"],
): SizeChartRowInput[] | null {
  if (value == null) return null;
  const parsed = sizeChartSchema.safeParse(value);
  return parsed.success ? parsed.data.rows : null;
}
