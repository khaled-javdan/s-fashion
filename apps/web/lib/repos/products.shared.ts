// Client-safe product helpers and types. This module must NOT import `prisma`
// (or anything from `@workspace/db` other than types), so that client
// components can import the pure helpers below without pulling the server-only
// Prisma client — and its Node built-ins like `node:fs` — into the browser
// bundle. The server-side repo (`products.repo.ts`) re-exports these.
import type { Product, ProductVariant, ProductImage } from "@workspace/db";

import {
  sizeChartSchema,
  type SizeChartInput,
  type SizeChartRowInput,
} from "@/lib/schemas/product.schema";

export type ProductWithRelations = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

/**
 * Parse a product's stored `sizeChart` JSON into a validated chart (rows +
 * unit), or `null` when the product has no override (the storefront falls back
 * to the global `size_chart.cm` setting). Malformed JSON is treated as no
 * override.
 */
export function parseProductSizeChart(
  value: Product["sizeChart"],
): SizeChartInput | null {
  if (value == null) return null;
  const parsed = sizeChartSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Convenience: just the rows. Retained for callers that don't need the unit.
 * Prefer {@link parseProductSizeChart} when rendering — the unit drives the
 * storefront's INCHES|CM toggle default.
 */
export function parseProductSizeChartRows(
  value: Product["sizeChart"],
): SizeChartRowInput[] | null {
  return parseProductSizeChart(value)?.rows ?? null;
}
