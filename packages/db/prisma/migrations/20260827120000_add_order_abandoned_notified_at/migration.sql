-- Abandoned-checkout recovery stamp. Written when the recovery email for an
-- unpaid, expired Stripe order is sent, so the sweep never emails the same
-- order twice. Nullable so every existing row is treated as "not yet emailed"
-- — and the sweep's own age window keeps it from mailing historic orders.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "abandonedNotifiedAt" TIMESTAMP(3);
