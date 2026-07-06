-- Admin-controlled manual display order for products. Defaults to 0 for
-- every existing row, so storefront ordering is unchanged until an admin
-- drags a product in the admin table.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_isActive_sortOrder_idx" ON "Product"("isActive", "sortOrder");
