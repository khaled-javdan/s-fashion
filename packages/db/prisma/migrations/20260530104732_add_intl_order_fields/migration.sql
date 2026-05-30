-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "country" TEXT DEFAULT 'AE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'AE',
ADD COLUMN     "displayCurrency" TEXT NOT NULL DEFAULT 'AED',
ADD COLUMN     "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
ALTER COLUMN "emirate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Order_country_idx" ON "Order"("country");
