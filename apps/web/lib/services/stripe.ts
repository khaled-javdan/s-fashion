/**
 * Stripe client wrapper (hosted Stripe Checkout).
 *
 * The store charges in base AED only: `Order.totalFils` is already the
 * integer minor-unit amount Stripe expects for `aed`, so amounts are passed
 * through untouched. Display currencies (SAR, KWD, …) remain display-only.
 *
 * Env vars (server-only):
 * - STRIPE_SECRET_KEY     — secret API key (sk_test_... / sk_live_...)
 * - STRIPE_WEBHOOK_SECRET — signing secret of the /api/webhooks/stripe
 *                           endpoint (whsec_...)
 *
 * Must not be imported by client components.
 */

import Stripe from "stripe";

import { AppError } from "@/lib/errors";

let client: Stripe | null = null;

/** Whether online card payments can be offered (secret key present). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily-instantiated Stripe singleton. Throws an expected AppError when the
 * secret key is missing — callers gate on `isStripeConfigured()` first, so
 * this only fires on genuine misconfiguration.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError(
      "stripe_not_configured",
      "Stripe is not configured (STRIPE_SECRET_KEY missing).",
      { expected: false },
    );
  }
  // No apiVersion override: the SDK pins the API version it ships with, so
  // webhook/session payload shapes stay stable across dashboard changes.
  client = new Stripe(key);
  return client;
}
