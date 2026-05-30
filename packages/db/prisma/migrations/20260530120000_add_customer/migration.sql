-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "locale" TEXT NOT NULL,
    "emirate" "Emirate",
    "city" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "consentSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_marketingConsent_idx" ON "Customer"("marketingConsent");

-- CreateIndex
CREATE INDEX "Customer_emirate_idx" ON "Customer"("emirate");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: seed one Customer per distinct phone from existing orders.
-- The contact/address snapshot comes from each phone's most recent order;
-- createdAt is the phone's earliest order. marketingConsent stays false —
-- these customers never opted in, so they must not be marketed to.
INSERT INTO "Customer" (
    "id", "phone", "name", "email", "locale",
    "emirate", "city", "addressLine1", "addressLine2",
    "marketingConsent", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    latest."phone",
    latest."customerName",
    latest."email",
    latest."locale",
    latest."emirate",
    latest."city",
    latest."addressLine1",
    latest."addressLine2",
    false,
    agg."firstAt",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("phone")
        "phone", "customerName", "email", "locale",
        "emirate", "city", "addressLine1", "addressLine2"
    FROM "Order"
    ORDER BY "phone", "createdAt" DESC
) AS latest
JOIN (
    SELECT "phone", MIN("createdAt") AS "firstAt"
    FROM "Order"
    GROUP BY "phone"
) AS agg ON agg."phone" = latest."phone";

-- Link every existing order to its newly-created customer.
UPDATE "Order" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."phone" = o."phone";
