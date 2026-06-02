-- Soft-delete flag for variants that have OrderItem references. Postgres
-- can't hard-delete a variant once it's referenced (the OrderItem FK is
-- RESTRICT, by design — order history must not be destroyed), so the admin's
-- "remove" action archives the row instead. Storefront and admin product
-- editor queries filter `isArchived = false`; order-history queries
-- dereference via FK and don't care about the flag.

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isArchived_idx" ON "ProductVariant"("productId", "isArchived");
