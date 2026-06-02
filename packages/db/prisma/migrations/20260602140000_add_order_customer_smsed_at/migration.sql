-- Customer-facing SMS confirmation stamp. Mirrors `customerEmailedAt` and
-- `adminNotifiedAt`: the order-notifications dispatcher writes this when a
-- Twilio SMS confirmation succeeds, and the retry cron picks up any unstamped
-- order. Nullable so existing rows are treated as "not yet SMSed".

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerSmsedAt" TIMESTAMP(3);
