-- AlterTable
ALTER TABLE "Product" ADD COLUMN "costPriceFils" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "unitCostFils" INTEGER NOT NULL DEFAULT 0;
