/**
 * Abandoned-checkout recovery.
 *
 * Chases checkouts that were started and never paid for: one email, once, with
 * an optional discount and a link back to a refilled basket. Everything is
 * driven by the `checkout.abandoned_email` setting — including whether it runs
 * at all, which is **off** until the shop owner switches it on.
 *
 * The sweep is deliberately conservative about who it mails (see
 * `listAbandonedCheckouts`) and stamps every order it touches, so re-running it
 * — from the cron or by hand — never double-sends. Server-only.
 */
import { CouponType } from "@workspace/db";

import { appBaseUrl } from "@/lib/base-url";
import { reportError } from "@/lib/errors";
import type { Locale } from "@/lib/locale";
import { createCoupon, generateUniqueCode } from "@/lib/repos/coupons.repo";
import {
  listAbandonedCheckouts,
  markAbandonedNotified,
  type AbandonedCheckout,
} from "@/lib/repos/orders.repo";
import {
  DEFAULT_ABANDONED_EMAIL,
  getSetting,
} from "@/lib/repos/settings.repo";
import { sendAbandonedCheckoutEmail } from "@/lib/services/resend";

/** Prefix for recovery codes, kept distinct from the exit offer's `STAY-`. */
export const RECOVERY_COUPON_PREFIX = "COMEBACK";

/** Narrow a persisted locale string to the two we render. */
function toLocale(raw: string): Locale {
  return raw === "ar" ? "ar" : "en";
}

/**
 * Link back to the storefront basket, refilled from the abandoned order. The
 * cart page reads `?restore=` and merges that order's lines into the cart.
 */
function restoreUrl(locale: Locale, orderNumber: string): string {
  return `${appBaseUrl()}/${locale}/cart?restore=${encodeURIComponent(orderNumber)}`;
}

/** Mint the single-use recovery code for one customer, or null when disabled. */
async function mintRecoveryCoupon(
  percent: number,
  hours: number,
): Promise<{ code: string; percent: number; expiresAt: Date } | null> {
  if (percent <= 0) return null;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const code = await generateUniqueCode(RECOVERY_COUPON_PREFIX);
  await createCoupon({
    code,
    type: CouponType.PERCENT,
    value: percent,
    minSubtotalFils: 0,
    maxDiscountFils: null,
    firstOrderOnly: false,
    // One use, not phone-gated — the recipient may check out from a different
    // number than the one on the abandoned order.
    maxRedemptions: 1,
    perCustomerLimit: null,
    startsAt: null,
    expiresAt,
    isActive: true,
  });
  return { code, percent, expiresAt };
}

/** Send the recovery email for one abandoned checkout. Never throws. */
async function recoverOne(
  order: AbandonedCheckout,
  percent: number,
  couponHours: number,
): Promise<boolean> {
  const locale = toLocale(order.locale);
  const coupon = await mintRecoveryCoupon(percent, couponHours);

  const result = await sendAbandonedCheckoutEmail({
    to: order.email,
    locale,
    payload: {
      customerName: order.customerName,
      items: order.items.map((item) => ({
        productName: locale === "ar" ? item.productNameAr : item.productNameEn,
        variantLabel:
          [locale === "ar" ? item.colorNameAr : item.colorNameEn, item.size]
            .filter(Boolean)
            .join(" · ") || undefined,
        quantity: item.quantity,
        unitPriceFils: item.unitPriceFils,
      })),
      subtotalFils: order.subtotalFils,
      cartUrl: restoreUrl(locale, order.orderNumber),
      logoUrl: `${appBaseUrl()}/logo.png`,
      coupon,
    },
  });

  if (!result.ok) {
    // Leave the order unstamped so the next sweep retries it — the age window
    // in the query is what eventually stops us chasing a dead address.
    reportError(
      "abandonedCheckout.send",
      new Error(result.error),
      { orderId: order.id },
    );
    return false;
  }

  await markAbandonedNotified(order.id);
  return true;
}

export type RecoverySweepResult = {
  /** False when the feature is switched off — nothing was looked at. */
  enabled: boolean;
  found: number;
  sent: number;
};

/**
 * Run one recovery sweep. Safe to call repeatedly; each order is emailed at
 * most once. One failure never aborts the batch.
 */
export async function sweepAbandonedCheckouts(): Promise<RecoverySweepResult> {
  const config =
    (await getSetting("checkout.abandoned_email")) ?? DEFAULT_ABANDONED_EMAIL;
  if (!config.enabled) return { enabled: false, found: 0, sent: 0 };

  const orders = await listAbandonedCheckouts(config.delayMinutes);
  let sent = 0;
  for (const order of orders) {
    try {
      if (await recoverOne(order, config.percent, config.couponHours)) sent++;
    } catch (err) {
      reportError("abandonedCheckout.order", err, { orderId: order.id });
    }
  }
  return { enabled: true, found: orders.length, sent };
}
