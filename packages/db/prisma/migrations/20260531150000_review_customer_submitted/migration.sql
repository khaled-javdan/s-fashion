-- AlterTable
ALTER TABLE "Review" ADD COLUMN "authorEmail" TEXT;
ALTER TABLE "Review" ADD COLUMN "isCustomerSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Review_isCustomerSubmitted_isVisible_idx" ON "Review"("isCustomerSubmitted", "isVisible");
