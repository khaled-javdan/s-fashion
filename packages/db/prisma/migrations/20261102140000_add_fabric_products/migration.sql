-- Fabric products: a product can be a ready-made GARMENT (default, all existing
-- rows) or a FABRIC piece sold as a fixed pre-cut length. Additive only.

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('GARMENT', 'FABRIC');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'GARMENT',
ADD COLUMN     "fabricMaterial" TEXT,
ADD COLUMN     "fabricWidthCm" INTEGER,
ADD COLUMN     "fabricLengthCm" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "pieceLengthCm" INTEGER;

-- CreateIndex
CREATE INDEX "Product_kind_fabricMaterial_idx" ON "Product"("kind", "fabricMaterial");
