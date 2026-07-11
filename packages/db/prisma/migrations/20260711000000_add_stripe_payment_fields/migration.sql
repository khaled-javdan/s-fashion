-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- AlterEnum
-- NOTE: the new value must not be referenced by any DML in this same
-- migration (PG restriction on ALTER TYPE ... ADD VALUE in a transaction).
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'COD',
  ADD COLUMN "paymentStatus" "PaymentStatus",
  ADD COLUMN "stripeSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
