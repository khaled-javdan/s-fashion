-- AlterTable
-- Optional per-product size chart override. Nullable with no default: existing
-- rows stay NULL and the storefront falls back to the global `size_chart.cm`
-- setting, so no backfill is required.
ALTER TABLE "Product" ADD COLUMN "sizeChart" JSONB;
