/**
 * Resend transactional email wrapper.
 *
 * Sends bilingual order confirmation emails using inline HTML. No external
 * template service.
 *
 * Env vars (server-only):
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL  e.g. "S Fashion <orders@sfashion.ae>"
 *
 * Must not be imported by client components.
 */
import { Resend } from "resend";

import { formatMoney, isCurrencyCode } from "@/lib/currency";

export type Locale = "ar" | "en";

export interface OrderEmailLineItem {
  productName: string;
  variantLabel?: string;
  quantity: number;
  /** Unit price in fils. */
  unitPriceFils: number;
}

export interface OrderEmailPayload {
  orderNumber: string;
  customerName: string;
  /** All line items already snapshotted at order time. */
  items: OrderEmailLineItem[];
  subtotalFils: number;
  shippingFils: number;
  totalFils: number;
  /** Display currency the shopper saw (ISO code, e.g. "SAR"). Defaults to AED. */
  currency?: string;
  /** AED→currency rate at order time. Defaults to 1 (base AED). */
  fxRate?: number;
  /**
   * Estimated delivery window (business days) for the order's destination.
   * Both default to the historical AE values (1–3) when not supplied.
   */
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
}

/** Default delivery window used when the order omits an explicit range. */
const DEFAULT_DELIVERY_MIN_DAYS = 1;
const DEFAULT_DELIVERY_MAX_DAYS = 3;

export interface SendOrderEmailInput {
  to: string;
  locale: Locale;
  order: OrderEmailPayload;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let cachedClient: Resend | null = null;

function getClient(): Resend {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Resend is not configured: RESEND_API_KEY missing.");
  }
  cachedClient = new Resend(key);
  return cachedClient;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "Resend is not configured: RESEND_FROM_EMAIL missing.",
    );
  }
  return from;
}

/**
 * Send a bilingual order confirmation email. The body language is chosen
 * by `locale` ("ar" or "en"); the rendered HTML uses `dir="rtl"` for ar.
 * Never throws — returns a tagged result.
 */
export async function sendOrderConfirmationEmail(
  input: SendOrderEmailInput,
): Promise<SendEmailResult> {
  try {
    const client = getClient();
    const from = getFromAddress();
    const subject = renderSubject(input.locale, input.order.orderNumber);
    const html = renderOrderHtml(input.locale, input.order);
    const text = renderOrderText(input.locale, input.order);

    const result = await client.emails.send({
      from,
      to: input.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      const error = result.error.message ?? "Resend returned an error.";
      console.error("[resend.sendOrderConfirmationEmail]", error);
      return { ok: false, error };
    }

    const id = result.data?.id ?? "";
    return { ok: true, id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send email.";
    console.error("[resend.sendOrderConfirmationEmail]", message);
    return { ok: false, error: message };
  }
}

// ─── Rendering helpers ────────────────────────────────────────────────

function renderSubject(locale: Locale, orderNumber: string): string {
  return locale === "ar"
    ? `تم استلام طلبك ${orderNumber} — S Fashion`
    : `Your order ${orderNumber} has been received — S Fashion`;
}

/**
 * Build a money formatter for the order's display currency. Money is stored in
 * base AED fils; the email renders it in the currency the shopper saw at
 * checkout (falls back to AED at rate 1 for legacy orders / unknown codes).
 */
function moneyFormatter(
  locale: Locale,
  currencyRaw: string | undefined,
  fxRate: number | undefined,
): (fils: number) => string {
  const currency =
    currencyRaw && isCurrencyCode(currencyRaw) ? currencyRaw : "AED";
  const rate = currency === "AED" ? 1 : fxRate && fxRate > 0 ? fxRate : 1;
  return (fils: number) => formatMoney(fils, { locale, currency, rate });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Strings {
  greeting: (name: string) => string;
  intro: string;
  orderNumberLabel: string;
  itemsHeading: string;
  qtyLabel: string;
  subtotalLabel: string;
  shippingLabel: string;
  totalLabel: string;
  outro: (minDays: number, maxDays: number) => string;
  signature: string;
}

const STRINGS: Record<Locale, Strings> = {
  ar: {
    greeting: (name) => `مرحباً ${name}،`,
    intro: "شكراً لطلبك من S Fashion. تم استلام طلبك وسنقوم بتأكيده قريباً.",
    orderNumberLabel: "رقم الطلب",
    itemsHeading: "تفاصيل الطلب",
    qtyLabel: "الكمية",
    subtotalLabel: "المجموع الفرعي",
    shippingLabel: "رسوم التوصيل",
    totalLabel: "الإجمالي",
    outro: (minDays, maxDays) => `التوصيل خلال ${minDays}-${maxDays} أيام عمل.`,
    signature: "مع تحياتنا، فريق S Fashion",
  },
  en: {
    greeting: (name) => `Hello ${name},`,
    intro:
      "Thank you for your order with S Fashion. We've received your order and will confirm it shortly.",
    orderNumberLabel: "Order number",
    itemsHeading: "Order details",
    qtyLabel: "Qty",
    subtotalLabel: "Subtotal",
    shippingLabel: "Shipping",
    totalLabel: "Total",
    outro: (minDays, maxDays) =>
      `Expected delivery within ${minDays}-${maxDays} business days.`,
    signature: "With care, the S Fashion team",
  },
};

/** Resolve the order's delivery window, applying defaults for missing fields. */
function deliveryWindow(order: OrderEmailPayload): {
  minDays: number;
  maxDays: number;
} {
  const minDays =
    typeof order.deliveryMinDays === "number"
      ? order.deliveryMinDays
      : DEFAULT_DELIVERY_MIN_DAYS;
  const maxDays =
    typeof order.deliveryMaxDays === "number"
      ? order.deliveryMaxDays
      : DEFAULT_DELIVERY_MAX_DAYS;
  return { minDays, maxDays };
}

function renderOrderHtml(locale: Locale, order: OrderEmailPayload): string {
  const t = STRINGS[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const lang = locale;
  const fmt = moneyFormatter(locale, order.currency, order.fxRate);
  const { minDays, maxDays } = deliveryWindow(order);

  const rows = order.items
    .map((item) => {
      const label = item.variantLabel
        ? `${item.productName} — ${item.variantLabel}`
        : item.productName;
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${escapeHtml(label)}
            <div style="color:#666;font-size:12px;">${escapeHtml(t.qtyLabel)}: ${item.quantity}</div>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:${dir === "rtl" ? "left" : "right"};white-space:nowrap;">
            ${escapeHtml(fmt(item.unitPriceFils * item.quantity))}
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(renderSubject(locale, order.orderNumber))}</title>
  </head>
  <body style="margin:0;padding:0;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px;border-radius:8px;max-width:560px;width:100%;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px 0;font-size:20px;letter-spacing:3px;">S FASHION</h1>
                <p style="margin:0 0 12px 0;">${escapeHtml(t.greeting(order.customerName))}</p>
                <p style="margin:0 0 16px 0;line-height:1.5;">${escapeHtml(t.intro)}</p>

                <p style="margin:0 0 8px 0;">
                  <strong>${escapeHtml(t.orderNumberLabel)}:</strong>
                  ${escapeHtml(order.orderNumber)}
                </p>

                <h2 style="font-size:14px;margin:24px 0 8px 0;">${escapeHtml(t.itemsHeading)}</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${rows}
                  <tr>
                    <td style="padding:8px 0;">${escapeHtml(t.subtotalLabel)}</td>
                    <td style="padding:8px 0;text-align:${dir === "rtl" ? "left" : "right"};">${escapeHtml(fmt(order.subtotalFils))}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">${escapeHtml(t.shippingLabel)}</td>
                    <td style="padding:8px 0;text-align:${dir === "rtl" ? "left" : "right"};">${escapeHtml(fmt(order.shippingFils))}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-top:1px solid #222;font-weight:bold;">${escapeHtml(t.totalLabel)}</td>
                    <td style="padding:12px 0;border-top:1px solid #222;font-weight:bold;text-align:${dir === "rtl" ? "left" : "right"};">${escapeHtml(fmt(order.totalFils))}</td>
                  </tr>
                </table>

                <p style="margin:24px 0 0 0;color:#666;font-size:13px;">${escapeHtml(t.outro(minDays, maxDays))}</p>
                <p style="margin:24px 0 0 0;font-size:13px;">${escapeHtml(t.signature)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderOrderText(locale: Locale, order: OrderEmailPayload): string {
  const t = STRINGS[locale];
  const fmt = moneyFormatter(locale, order.currency, order.fxRate);
  const { minDays, maxDays } = deliveryWindow(order);
  const lines: string[] = [
    "S FASHION",
    "",
    t.greeting(order.customerName),
    t.intro,
    "",
    `${t.orderNumberLabel}: ${order.orderNumber}`,
    "",
    t.itemsHeading,
  ];
  for (const item of order.items) {
    const label = item.variantLabel
      ? `${item.productName} — ${item.variantLabel}`
      : item.productName;
    lines.push(
      `- ${label} (${t.qtyLabel}: ${item.quantity}) — ${fmt(item.unitPriceFils * item.quantity)}`,
    );
  }
  lines.push(
    "",
    `${t.subtotalLabel}: ${fmt(order.subtotalFils)}`,
    `${t.shippingLabel}: ${fmt(order.shippingFils)}`,
    `${t.totalLabel}: ${fmt(order.totalFils)}`,
    "",
    t.outro(minDays, maxDays),
    "",
    t.signature,
  );
  return lines.join("\n");
}
