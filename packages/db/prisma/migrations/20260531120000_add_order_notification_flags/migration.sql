-- AlterTable
-- Notification delivery stamps. Nullable, no default: existing rows are treated
-- as "not yet notified" (NULL); the retry cron will pick them up if still within
-- its lookback window, otherwise they remain harmlessly unstamped.
ALTER TABLE "Order" ADD COLUMN "adminNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "customerEmailedAt" TIMESTAMP(3);
