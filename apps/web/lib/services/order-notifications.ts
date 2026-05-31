/**
 * Order-notification dispatcher.
 *
 * Single source of truth for the two side-effects fired after an order is
 * created: the Telegram alert to the shop owner and the Resend confirmation
 * email to the customer. Both are best-effort, but no longer silently lost —
 * each successful send stamps a column on the Order (`adminNotifiedAt` /
 * `customerEmailedAt`), and a retry cron (`/api/cron/retry-notifications`)
 * re-runs this for any order still missing a stamp.
 *
 * Payloads are rebuilt from the persisted order + item snapshots, so this is
 * safe to call both inline (right after createOrder) and from the cron without
 * carrying any in-memory state. Idempotent: an already-stamped channel is
 * skipped. Server-only — never import from a client component.
 */
import { prisma } from "@workspace/db";

import type { Locale } from "@/lib/locale";
import { getSetting } from "@/lib/repos/settings.repo";
import { sendOrderConfirmationEmail } from "@/lib/services/resend";
import { sendOrderNotification } from "@/lib/services/telegram";
import { parseShippingConfig, resolveShipping } from "@/lib/shipping-config";

function absoluteAdminOrderUrl(orderId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/admin/orders/${orderId}`;
}

/**
 * Send any not-yet-delivered notifications for an order, stamping the Order on
 * each success. Never throws — failures are logged and left for the next retry.
 */
export async function dispatchOrderNotifications(
  orderId: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  const locale: Locale = order.locale === "ar" ? "ar" : "en";

  // ── Telegram (owner alert) ──────────────────────────────────────────────
  if (!order.adminNotifiedAt) {
    const result = await sendOrderNotification({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      country: order.country,
      emirate: order.emirate,
      totalFils: order.totalFils,
      itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
      adminUrl: absoluteAdminOrderUrl(order.id),
    });
    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { adminNotifiedAt: new Date() },
      });
    }
  }

  // ── Resend (customer confirmation) ──────────────────────────────────────
  if (order.email && !order.customerEmailedAt) {
    // Resolve the destination's estimated delivery window so the email shows
    // the configured per-country range rather than a hardcoded default.
    const shippingConfig = parseShippingConfig(
      await getSetting("shipping.countries"),
    );
    const { minDays, maxDays } = resolveShipping(
      shippingConfig,
      order.country,
      order.subtotalFils,
    );

    const result = await sendOrderConfirmationEmail({
      to: order.email,
      locale,
      order: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        items: order.items.map((i) => ({
          productName: locale === "ar" ? i.productNameAr : i.productNameEn,
          variantLabel: [
            locale === "ar" ? i.colorNameAr : i.colorNameEn,
            i.size,
          ]
            .filter(Boolean)
            .join(" · "),
          quantity: i.quantity,
          unitPriceFils: i.unitPriceFils,
        })),
        subtotalFils: order.subtotalFils,
        shippingFils: order.shippingFils,
        totalFils: order.totalFils,
        currency: order.displayCurrency,
        fxRate: order.fxRate,
        deliveryMinDays: minDays,
        deliveryMaxDays: maxDays,
      },
    });
    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { customerEmailedAt: new Date() },
      });
    }
  }
}
