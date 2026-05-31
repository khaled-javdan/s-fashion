/**
 * Retry cron for order notifications.
 *
 * Re-runs `dispatchOrderNotifications` for any recent, verified order still
 * missing a delivery stamp (Telegram owner alert and/or customer email). This
 * is what makes the fire-and-forget notifications fired at checkout durable: a
 * transient Telegram/Resend failure is recovered on the next run instead of
 * being silently lost. The dispatcher is idempotent — already-stamped channels
 * are skipped — so re-running is safe.
 *
 * Scheduled daily in vercel.json (`0 3 * * *`) — the Vercel Hobby plan only
 * permits once-per-day crons. If sub-daily recovery is needed, either upgrade
 * to Pro (and restore an every-15-minutes schedule) or hit this endpoint from
 * an external scheduler with the CRON_SECRET bearer token.
 *
 * Vercel cron requests carry `Authorization: Bearer $CRON_SECRET`; we reject
 * anything else when the secret is configured. When CRON_SECRET is unset (local
 * dev) the route runs unauthenticated so it can be exercised by hand.
 */
import { NextResponse } from "next/server";

import { dispatchOrderNotifications } from "@/lib/services/order-notifications";
import { listOrderIdsAwaitingNotification } from "@/lib/repos/orders.repo";

// Always run dynamically — never cache the cron response.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let ids: string[];
  try {
    ids = await listOrderIdsAwaitingNotification();
  } catch (err) {
    console.error("[cron.retry-notifications] query failed", err);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let processed = 0;
  for (const id of ids) {
    try {
      await dispatchOrderNotifications(id);
      processed++;
    } catch (err) {
      // dispatchOrderNotifications never throws, but guard anyway so one bad
      // order can't abort the whole batch.
      console.error("[cron.retry-notifications] dispatch failed", id, err);
    }
  }

  return NextResponse.json({ ok: true, found: ids.length, processed });
}
