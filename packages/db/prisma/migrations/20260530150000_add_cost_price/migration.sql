-- AlterTable
-- costPriceFils is NOT NULL with no default: this migration only runs against a
-- freshly reset (empty) Product table, so there are no existing rows to backfill.
ALTER TABLE "Product" ADD COLUMN "costPriceFils" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCostFils" INTEGER NOT NULL DEFAULT 0;
