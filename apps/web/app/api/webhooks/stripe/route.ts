/**
 * Stripe webhook endpoint.
 *
 * Configured in the Stripe dashboard as https://<domain>/api/webhooks/stripe
 * with events: checkout.session.completed, checkout.session.expired,
 * charge.refunded. Requests are authenticated by verifying the
 * `stripe-signature` header against STRIPE_WEBHOOK_SECRET over the RAW body —
 * never parse the body before verification.
 *
 * Every handler is idempotent (events can be replayed, and the return-page
 * reconcile / cron backstop may have processed the order first), so any
 * unexpected failure returns 500 to make Stripe retry safely.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { reportError } from "@/lib/errors";
import {
  cancelExpiredStripeOrder,
  markOrderPaidBySession,
  markOrderRefundedByPaymentIntent,
} from "@/lib/repos/orders.repo";
import { dispatchOrderNotifications } from "@/lib/services/order-notifications";
import { getStripe, isStripeConfigured } from "@/lib/services/stripe";

// Never cache; allow time for the notification fan-out after payment.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !isStripeConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    reportError("api:webhooks/stripe.signature", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // Cards are always "paid" at completion; guard for any future
        // delayed-notification payment method.
        if (session.payment_status !== "paid") break;
        await handleSessionPaid(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        await cancelExpiredStripeOrder(session.id);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        // Payment bookkeeping only — the admin cancels/refuses + restocks
        // manually after refunding in the Stripe dashboard.
        if (!charge.refunded) break; // partial refund: leave status as PAID
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) break;
        const res = await markOrderRefundedByPaymentIntent(paymentIntentId);
        if (!res.found) {
          reportError(
            "api:webhooks/stripe.refund_order_not_found",
            new Error(`No order for payment intent ${paymentIntentId}`),
            { eventId: event.id },
          );
        }
        break;
      }
      default:
        break; // unrecognised events are acknowledged, not retried
    }
  } catch (err) {
    reportError("api:webhooks/stripe.handler", err, {
      eventId: event.id,
      type: event.type,
    });
    // 500 → Stripe retries with backoff; handlers are idempotent.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSessionPaid(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  // metadata.orderId covers the tiny window where the webhook lands before
  // the session id is persisted on the order.
  const result = await markOrderPaidBySession(
    session.id,
    paymentIntentId,
    session.metadata?.orderId,
  );

  switch (result.outcome) {
    case "paid":
      // Customer + owner notifications fire only now that money is in. The
      // dispatcher is idempotent and the retry cron backstops failures.
      await dispatchOrderNotifications(result.orderId);
      return;
    case "already_paid":
      return; // replay / return-page reconcile won the race
    case "paid_but_cancelled":
      // Paid after expiry AND the stock was resold — needs a manual refund.
      reportError(
        "api:webhooks/stripe.paid_after_expired",
        new Error(
          `Order ${result.orderNumber} paid after expiry but stock is gone — refund in Stripe dashboard`,
        ),
        { orderId: result.orderId, sessionId: session.id },
      );
      return;
    case "not_found":
      reportError(
        "api:webhooks/stripe.order_not_found",
        new Error(`No order for Checkout Session ${session.id}`),
        { sessionId: session.id, orderId: session.metadata?.orderId },
      );
      return;
  }
}
