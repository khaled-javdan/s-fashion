/**
 * Order-notification dispatcher.
 *
 * Single source of truth for the side-effects fired after an order is created:
 *   1. Telegram alert to the shop owner          → `adminNotifiedAt`
 *   2. Resend confirmation email to the customer → `customerEmailedAt`
 *   3. Twilio SMS confirmation to the customer   → `customerSmsedAt`
 *
 * All are best-effort, but no longer silently lost — each successful send
 * stamps a column on the Order, and a retry cron (`/api/cron/retry-
 * notifications`) re-runs this for any order still missing a stamp.
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
import { sendOrderConfirmationSms } from "@/lib/services/order-sms";
import { sendOrderNotification } from "@/lib/services/telegram";
import { parseShippingConfig, resolveShipping } from "@/lib/shipping-config";

function appBaseUrl(): string {
  // `||` (not `??`) so an env var set to an empty string falls through instead
  // of yielding "" — that produced relative admin links (`/ar/admin/orders/…`)
  // in the Telegram alert. Vercel auto-sets VERCEL_PROJECT_PRODUCTION_URL (host
  // only, no scheme) on deployments; the production domain is the last resort
  // so the link is always absolute even with no env configured.
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.NODE_ENV === "production"
      ? "https://s-fashions.com"
      : "http://localhost:3000");
  return base.replace(/\/$/, "");
}

function absoluteAdminOrderUrl(locale: Locale, orderId: string): string {
  return `${appBaseUrl()}/${locale}/admin/orders/${orderId}`;
}

function absoluteCustomerOrderUrl(locale: Locale, orderNumber: string): string {
  return `${appBaseUrl()}/${locale}/orders/${orderNumber}`;
}

/** Absolute URL to the brand logo (logo.png in /public) for email headers. */
function logoUrl(): string {
  return `${appBaseUrl()}/logo.png`;
}

/** Bilingual display name for a GCC country code (falls back to the raw code). */
const COUNTRY_NAMES: Record<string, { en: string; ar: string }> = {
  AE: { en: "United Arab Emirates", ar: "الإمارات العربية المتحدة" },
  SA: { en: "Saudi Arabia", ar: "المملكة العربية السعودية" },
  KW: { en: "Kuwait", ar: "الكويت" },
  QA: { en: "Qatar", ar: "قطر" },
  BH: { en: "Bahrain", ar: "البحرين" },
  OM: { en: "Oman", ar: "عُمان" },
};

/** Bilingual emirate label (enum keys → display names). */
const EMIRATE_NAMES: Record<string, { en: string; ar: string }> = {
  ABU_DHABI: { en: "Abu Dhabi", ar: "أبوظبي" },
  DUBAI: { en: "Dubai", ar: "دبي" },
  SHARJAH: { en: "Sharjah", ar: "الشارقة" },
  AJMAN: { en: "Ajman", ar: "عجمان" },
  UMM_AL_QUWAIN: { en: "Umm Al Quwain", ar: "أم القيوين" },
  RAS_AL_KHAIMAH: { en: "Ras Al Khaimah", ar: "رأس الخيمة" },
  FUJAIRAH: { en: "Fujairah", ar: "الفجيرة" },
};

function countryLabel(code: string, locale: Locale): string {
  return COUNTRY_NAMES[code]?.[locale] ?? code;
}

function emirateLabel(emirate: string, locale: Locale): string {
  return EMIRATE_NAMES[emirate]?.[locale] ?? emirate;
}

/** Order shape used by the email-payload builders below. */
type OrderForEmail = NonNullable<
  Awaited<ReturnType<typeof loadOrderForNotifications>>
>;

/** Fetch the order with everything the notifications need, including the
 *  product images used to render item thumbnails in the confirmation email. */
function loadOrderForNotifications(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: { include: { product: { include: { images: true } } } },
        },
      },
    },
  });
}

/**
 * Resolve the best thumbnail for an order item: the product image matching the
 * variant's colour, else the first image by position. Best-effort + display
 * only — reading the current product image is fine for an email thumbnail even
 * though prices/names are snapshotted. URLs are already absolute (Blob/CDN).
 */
function itemImageUrl(item: OrderForEmail["items"][number]): string | undefined {
  const images = item.variant?.product?.images ?? [];
  if (images.length === 0) return undefined;
  const colorHex = item.variant?.colorHex?.toLowerCase();
  const match = colorHex
    ? images.find((im) => im.colorHex?.toLowerCase() === colorHex)
    : undefined;
  const chosen =
    match ?? [...images].sort((a, b) => a.position - b.position)[0];
  return chosen?.url;
}

/** Build the formatted ship-to address lines for the confirmation email. */
function shipToLines(order: OrderForEmail, locale: Locale): string[] {
  const lines = [order.addressLine1];
  if (order.addressLine2) lines.push(order.addressLine2);
  if (order.city) lines.push(order.city);
  const region = [
    order.emirate ? emirateLabel(order.emirate, locale) : null,
    countryLabel(order.country, locale),
  ]
    .filter(Boolean)
    .join(", ");
  if (region) lines.push(region);
  return lines;
}

/**
 * Send any not-yet-delivered notifications for an order, stamping the Order on
 * each success. Never throws — failures are logged and left for the next retry.
 */
export async function dispatchOrderNotifications(
  orderId: string,
): Promise<void> {
  const order = await loadOrderForNotifications(orderId);
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
      adminUrl: absoluteAdminOrderUrl(locale, order.id),
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
          imageUrl: itemImageUrl(i),
        })),
        subtotalFils: order.subtotalFils,
        shippingFils: order.shippingFils,
        discountFils: order.discountFils,
        totalFils: order.totalFils,
        currency: order.displayCurrency,
        fxRate: order.fxRate,
        deliveryMinDays: minDays,
        deliveryMaxDays: maxDays,
        shipTo: {
          name: order.customerName,
          lines: shipToLines(order, locale),
        },
        orderUrl: absoluteCustomerOrderUrl(locale, order.orderNumber),
        logoUrl: logoUrl(),
        placedAt: order.createdAt,
      },
    });
    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { customerEmailedAt: new Date() },
      });
    }
  }

  // ── Twilio (customer SMS confirmation) ──────────────────────────────────
  // Phone is always set + OTP-verified for verified orders, so we always
  // attempt SMS. If Twilio's messaging service isn't configured the call
  // returns a tagged error and the stamp stays null — the retry cron will
  // pick it up once the env var lands.
  if (!order.customerSmsedAt) {
    const result = await sendOrderConfirmationSms({
      to: order.phone,
      locale,
      trackUrl: absoluteCustomerOrderUrl(locale, order.orderNumber),
      order: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalFils: order.totalFils,
        currency: order.displayCurrency,
        fxRate: order.fxRate,
      },
    });
    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { customerSmsedAt: new Date() },
      });
    }
  }
}
