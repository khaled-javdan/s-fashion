/**
 * Retry cron for order notifications + stale-Stripe-order sweep.
 *
 * Re-runs `dispatchOrderNotifications` for any recent, verified order still
 * missing a delivery stamp (Telegram owner alert and/or customer email). This
 * is what makes the fire-and-forget notifications fired at checkout durable: a
 * transient Telegram/Resend failure is recovered on the next run instead of
 * being silently lost. The dispatcher is idempotent — already-stamped channels
 * are skipped — so re-running is safe.
 *
 * Also backstops missed Stripe webhooks: any order stuck AWAITING_PAYMENT
 * well past the 1-hour Checkout Session expiry is reconciled against Stripe —
 * marked paid if the completed webhook was lost, otherwise cancelled and its
 * reserved stock re-credited.
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

import { OrderStatus } from "@workspace/db";

import { reportError } from "@/lib/errors";
import { dispatchOrderNotifications } from "@/lib/services/order-notifications";
import {
  cancelExpiredStripeOrder,
  listOrderIdsAwaitingNotification,
  listStaleAwaitingPaymentOrders,
  markOrderPaidBySession,
  updateOrderStatus,
} from "@/lib/repos/orders.repo";
import { getStripe, isStripeConfigured } from "@/lib/services/stripe";

// Always run dynamically — never cache the cron response.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    reportError("cron.retry-notifications.query", err);
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
      reportError("cron.retry-notifications.dispatch", err, { id });
    }
  }

  // Stripe backstop: reconcile orders whose completed/expired webhook was
  // missed. Ask Stripe FIRST so a paid order whose webhook was lost is never
  // cancelled + restocked by mistake.
  let stripeReconciled = 0;
  let stripeCancelled = 0;
  if (isStripeConfigured()) {
    let stale: { id: string; stripeSessionId: string | null }[] = [];
    try {
      stale = await listStaleAwaitingPaymentOrders(2);
    } catch (err) {
      reportError("cron.stripe-sweep.query", err);
    }
    for (const order of stale) {
      try {
        if (!order.stripeSessionId) {
          // Session creation failed mid-checkout and the cleanup cancel also
          // failed — nothing to reconcile against; release the stock.
          await updateOrderStatus(
            order.id,
            OrderStatus.CANCELLED,
            null,
            "payment_expired",
          );
          stripeCancelled++;
          continue;
        }
        const session = await getStripe().checkout.sessions.retrieve(
          order.stripeSessionId,
        );
        if (session.payment_status === "paid") {
          const result = await markOrderPaidBySession(
            session.id,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          );
          if (result.outcome === "paid") {
            await dispatchOrderNotifications(result.orderId);
            stripeReconciled++;
          }
        } else {
          const result = await cancelExpiredStripeOrder(order.stripeSessionId);
          if (result.cancelled) stripeCancelled++;
        }
      } catch (err) {
        reportError("cron.stripe-sweep.order", err, { orderId: order.id });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    found: ids.length,
    processed,
    stripeReconciled,
    stripeCancelled,
  });
}
