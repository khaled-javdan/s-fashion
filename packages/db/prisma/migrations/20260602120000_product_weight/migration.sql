-- AlterTable
-- Optional per-product shipping weight in grams. Nullable with no default:
-- existing rows stay NULL (treated as 0 weight by the shipping calc), so no
-- backfill is required.
ALTER TABLE "Product" ADD COLUMN "weightGrams" INTEGER;
