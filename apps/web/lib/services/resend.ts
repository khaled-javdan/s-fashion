/**
 * Resend transactional email wrapper.
 *
 * Sends bilingual order confirmation emails using inline HTML. No external
 * template service. The layout mirrors a modern marketplace receipt (logo,
 * ship-to block, delivery estimate, status tracker, itemised list with
 * thumbnails) styled with the SFASHION design-system palette.
 *
 * Env vars (server-only):
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL  e.g. "SFASHION <orders@s-fashions.com>"
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
  /** Absolute thumbnail URL (best-effort; omitted when no image is available). */
  imageUrl?: string;
}

/** Pre-formatted ship-to address (name + display lines), built by the caller. */
export interface OrderEmailShipTo {
  name: string;
  lines: string[];
}

export interface OrderEmailPayload {
  orderNumber: string;
  customerName: string;
  /** All line items already snapshotted at order time. */
  items: OrderEmailLineItem[];
  subtotalFils: number;
  shippingFils: number;
  /** Coupon discount in fils (base AED). Omitted/0 when none was applied. */
  discountFils?: number;
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
  /** Ship-to address block. Omitted falls back to a no-address layout. */
  shipTo?: OrderEmailShipTo;
  /** Absolute URL to the customer's order page (the "View your order" CTA). */
  orderUrl?: string;
  /** Absolute URL to the brand logo image (logo.png in /public). */
  logoUrl?: string;
  /** When the order was placed — used to compute the delivery date range. */
  placedAt?: Date | string;
}

/** Default delivery window used when the order omits an explicit range. */
const DEFAULT_DELIVERY_MIN_DAYS = 1;
const DEFAULT_DELIVERY_MAX_DAYS = 3;

/**
 * SFASHION design-system palette, resolved from the oklch theme tokens to hex
 * (email clients don't support oklch). Keep in sync with
 * `packages/ui/src/styles/globals.css` :root.
 */
const C = {
  bg: "#faf6ef", // --background
  card: "#ffffff", // --card
  fg: "#1f1916", // --foreground
  primary: "#946646", // --primary
  primaryFg: "#faf8f5", // --primary-foreground
  secondary: "#f3eee6", // --secondary
  muted: "#efebe4", // --muted
  mutedFg: "#6a615b", // --muted-foreground
  border: "#e4ddd4", // --border
} as const;

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
    throw new Error("Resend is not configured: RESEND_FROM_EMAIL missing.");
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

/**
 * Render the order-confirmation email body as standalone HTML. Exported for
 * tests and an admin "preview email" view; the same output is what Resend sends.
 */
export function renderOrderConfirmationHtml(
  locale: Locale,
  order: OrderEmailPayload,
): string {
  return renderOrderHtml(locale, order);
}

// ─── Rendering helpers ────────────────────────────────────────────────

const BRAND = "SFASHION";

function renderSubject(locale: Locale, orderNumber: string): string {
  return locale === "ar"
    ? `تم تأكيد طلبك ${orderNumber} — ${BRAND}`
    : `Your order ${orderNumber} is confirmed — ${BRAND}`;
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

/**
 * Wrap a substring in Unicode isolate marks (LRI…PDI) so numeric ranges like
 * "1–3" / "15–20 Jun" keep their left-to-right order inside an RTL (Arabic)
 * line instead of bidi-reordering to "3–1". Works in HTML and plain text.
 */
function ltrIsolate(value: string): string {
  return `⁦${value}⁩`;
}

interface Strings {
  preview: string;
  confirmedTag: string;
  greeting: (name: string) => string;
  intro: string;
  addressNote: string;
  shipToLabel: string;
  deliveryLabel: string;
  businessDays: (minDays: number, maxDays: number) => string;
  viewOrder: string;
  steps: [string, string, string, string];
  itemsHeading: string;
  orderNumberLabel: string;
  qtyLabel: string;
  subtotalLabel: string;
  shippingLabel: string;
  freeShipping: string;
  discountLabel: string;
  totalLabel: string;
  help: string;
  signature: string;
}

const STRINGS: Record<Locale, Strings> = {
  ar: {
    preview: "تم تأكيد طلبك — نقوم بتجهيزه للشحن.",
    confirmedTag: "تم تأكيد الطلب",
    greeting: (name) => `مرحباً ${name}،`,
    intro:
      "تم تأكيد طلبك! نقوم بتجهيزه للشحن وسنرسل لك إشعاراً عند خروجه للتوصيل.",
    addressNote:
      "يرجى التأكد من صحة عنوان التوصيل أدناه — لا يمكن تغييره بعد شحن الطلب.",
    shipToLabel: "التوصيل إلى",
    deliveryLabel: "التوصيل",
    businessDays: (minDays, maxDays) =>
      `${ltrIsolate(`${minDays}–${maxDays}`)} أيام عمل`,
    viewOrder: "عرض طلبك",
    steps: ["تم التأكيد", "تم الشحن", "خرج للتوصيل", "تم التسليم"],
    itemsHeading: "تفاصيل الطلب",
    orderNumberLabel: "رقم الطلب",
    qtyLabel: "الكمية",
    subtotalLabel: "المجموع الفرعي",
    shippingLabel: "رسوم التوصيل",
    freeShipping: "مجاني",
    discountLabel: "الخصم",
    totalLabel: "الإجمالي",
    help: "لديك سؤال حول طلبك؟ ببساطة قم بالرد على هذا البريد.",
    signature: "مع تحياتنا، فريق SFASHION",
  },
  en: {
    preview: "Your order is confirmed — we're getting it ready to ship.",
    confirmedTag: "Order confirmed",
    greeting: (name) => `Hi ${name},`,
    intro:
      "Your order is confirmed! We're getting it ready for shipping and will notify you when it's on the way.",
    addressNote:
      "Please double-check the shipping address below — it can't be changed after the order ships.",
    shipToLabel: "Ship to",
    deliveryLabel: "Delivery",
    businessDays: (minDays, maxDays) => `${minDays}–${maxDays} business days`,
    viewOrder: "View your order",
    steps: ["Confirmed", "Shipped", "Out for delivery", "Delivered"],
    itemsHeading: "Order details",
    orderNumberLabel: "Order ID",
    qtyLabel: "Qty",
    subtotalLabel: "Subtotal",
    shippingLabel: "Shipping",
    freeShipping: "Free",
    discountLabel: "Discount",
    totalLabel: "Total",
    help: "Questions about your order? Just reply to this email.",
    signature: "With care, the SFASHION team",
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Format the estimated delivery date range, e.g. "16–23 Jun". Collapses the
 * month when both ends share it. Falls back to "now" when no placedAt is given.
 */
function deliveryDateRange(
  locale: Locale,
  placedAt: Date | string | undefined,
  minDays: number,
  maxDays: number,
): string {
  const base = placedAt ? new Date(placedAt) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  const start = addDays(base, Math.max(0, minDays));
  const end = addDays(base, Math.max(minDays, maxDays));
  // en-GB keeps day-before-month order ("15–20 Jun"); formatRange collapses a
  // shared month and handles cross-month spans on its own.
  const loc = locale === "ar" ? "ar" : "en-GB";
  const fmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" });
  const range =
    start.getTime() === end.getTime()
      ? fmt.format(start)
      : fmt.formatRange(start, end);
  return locale === "ar" ? ltrIsolate(range) : range;
}

/** Horizontal status tracker (Confirmed → Shipped → … ). `activeIndex` is the
 *  last completed step. Two aligned rows (circles+connectors, then labels). */
function renderTracker(
  steps: readonly string[],
  activeIndex: number,
  dir: "rtl" | "ltr",
): string {
  let circles = "";
  let labels = "";
  for (let i = 0; i < steps.length; i++) {
    const done = i <= activeIndex;
    const circle = `
      <td align="center" valign="middle" style="width:24px;">
        <div style="width:20px;height:20px;border-radius:50%;background:${
          done ? C.primary : C.card
        };border:2px solid ${done ? C.primary : C.border};text-align:center;">
          <span style="font-size:11px;line-height:20px;color:${C.primaryFg};">${
            done ? "&#10003;" : ""
          }</span>
        </div>
      </td>`;
    circles += circle;
    labels += `<td align="center" style="padding-top:6px;font-size:11px;line-height:1.3;color:${
      done ? C.fg : C.mutedFg
    };">${escapeHtml(steps[i] ?? "")}</td>`;
    if (i < steps.length - 1) {
      const filled = i + 1 <= activeIndex;
      circles += `<td valign="middle"><div style="height:2px;font-size:0;line-height:0;background:${
        filled ? C.primary : C.border
      };">&nbsp;</div></td>`;
      labels += "<td></td>";
    }
  }
  return `<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 4px 0;"><tr>${circles}</tr><tr>${labels}</tr></table>`;
}

function renderOrderHtml(locale: Locale, order: OrderEmailPayload): string {
  const t = STRINGS[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const alignEnd = dir === "rtl" ? "left" : "right";
  const alignStart = dir === "rtl" ? "right" : "left";
  const fmt = moneyFormatter(locale, order.currency, order.fxRate);
  const { minDays, maxDays } = deliveryWindow(order);
  const dateRange = deliveryDateRange(
    locale,
    order.placedAt,
    minDays,
    maxDays,
  );
  const discountFils = order.discountFils ?? 0;

  const logo = order.logoUrl
    ? `<img src="${escapeHtml(order.logoUrl)}" alt="" height="28" style="display:block;height:28px;width:auto;border:0;outline:none;" />`
    : "";

  const itemRows = order.items
    .map((item) => {
      const thumb = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid ${C.border};" />`
        : `<div style="width:56px;height:56px;border-radius:8px;background:${C.muted};border:1px solid ${C.border};"></div>`;
      const variant = item.variantLabel
        ? `<div style="font-size:12px;line-height:1.4;color:${C.mutedFg};margin-top:3px;">${escapeHtml(item.variantLabel)}</div>`
        : "";
      return `
        <tr>
          <td width="56" valign="top" style="padding:14px 0;">${thumb}</td>
          <td valign="top" style="padding:14px 14px;">
            <div style="font-size:14px;line-height:1.4;color:${C.fg};">${escapeHtml(item.productName)}</div>
            ${variant}
            <div style="font-size:12px;line-height:1.4;color:${C.mutedFg};margin-top:3px;">${escapeHtml(t.qtyLabel)} × ${item.quantity}</div>
          </td>
          <td valign="top" align="${alignEnd}" style="padding:14px 0;white-space:nowrap;font-size:14px;color:${C.fg};">${escapeHtml(fmt(item.unitPriceFils * item.quantity))}</td>
        </tr>`;
    })
    .join("");

  const totalRow = (
    label: string,
    value: string,
    opts: { strong?: boolean; accent?: boolean } = {},
  ): string => {
    const weight = opts.strong ? "700" : "400";
    const size = opts.strong ? "16px" : "14px";
    const color = opts.accent ? C.primary : opts.strong ? C.fg : C.mutedFg;
    const borderTop = opts.strong ? `border-top:1px solid ${C.border};` : "";
    const pad = opts.strong ? "14px 0 0 0" : "5px 0";
    return `
      <tr>
        <td style="padding:${pad};${borderTop}font-size:${size};font-weight:${weight};color:${opts.strong ? C.fg : C.mutedFg};">${escapeHtml(label)}</td>
        <td align="${alignEnd}" style="padding:${pad};${borderTop}font-size:${size};font-weight:${weight};color:${color};white-space:nowrap;">${escapeHtml(value)}</td>
      </tr>`;
  };

  const shipToBlock = order.shipTo
    ? `
      <tr><td style="padding:8px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.secondary};border:1px solid ${C.border};border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.mutedFg};margin-bottom:6px;">${escapeHtml(t.shipToLabel)}</div>
            <div style="font-size:14px;font-weight:700;color:${C.fg};margin-bottom:4px;">${escapeHtml(order.shipTo.name)}</div>
            ${order.shipTo.lines
              .map(
                (line) =>
                  `<div style="font-size:13px;line-height:1.5;color:${C.fg};">${escapeHtml(line)}</div>`,
              )
              .join("")}
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const deliveryLine = `${t.businessDays(minDays, maxDays)}${dateRange ? ` (${escapeHtml(dateRange)})` : ""}`;

  const ctaBlock = order.orderUrl
    ? `
      <tr><td align="center" style="padding:22px 28px 4px 28px;">
        <a href="${escapeHtml(order.orderUrl)}" style="display:inline-block;background:${C.primary};color:${C.primaryFg};text-decoration:none;font-size:15px;font-weight:700;padding:13px 40px;border-radius:999px;">${escapeHtml(t.viewOrder)}</a>
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(renderSubject(locale, order.orderNumber))}</title>
  </head>
  <body dir="${dir}" style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;color:${C.fg};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(t.preview)}</div>
    <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" dir="${dir}" width="600" cellpadding="0" cellspacing="0" style="background:${C.card};border-radius:14px;max-width:600px;width:100%;overflow:hidden;border:1px solid ${C.border};">

            <!-- Header -->
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid ${C.border};">
                <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="${alignStart}" valign="middle">
                      <table role="presentation" dir="${dir}" cellpadding="0" cellspacing="0"><tr>
                        ${logo ? `<td valign="middle" style="padding-${dir === "rtl" ? "left" : "right"}:10px;">${logo}</td>` : ""}
                        <td valign="middle"><span style="font-size:20px;font-weight:700;letter-spacing:3px;color:${C.fg};">${BRAND}</span></td>
                      </tr></table>
                    </td>
                    <td align="${alignEnd}" valign="middle" style="font-size:13px;color:${C.mutedFg};">${escapeHtml(t.confirmedTag)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Greeting + intro -->
            <tr>
              <td style="padding:24px 28px 4px 28px;">
                <p style="margin:0 0 10px 0;font-size:16px;font-weight:700;color:${C.fg};">${escapeHtml(t.greeting(order.customerName))}</p>
                <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:${C.fg};">${escapeHtml(t.intro)}</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:${C.mutedFg};">${escapeHtml(t.addressNote)}</p>
              </td>
            </tr>

            ${shipToBlock}

            <!-- Delivery estimate -->
            <tr>
              <td style="padding:18px 28px 0 28px;">
                <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};">
                  <tr>
                    <td align="${alignStart}" style="padding:14px 0;font-size:13px;color:${C.mutedFg};">${escapeHtml(t.deliveryLabel)}</td>
                    <td align="${alignEnd}" style="padding:14px 0;font-size:14px;font-weight:700;color:${C.primary};">${deliveryLine}</td>
                  </tr>
                </table>
              </td>
            </tr>

            ${ctaBlock}

            <!-- Status tracker -->
            <tr>
              <td style="padding:18px 28px 8px 28px;">
                ${renderTracker(t.steps, 0, dir)}
              </td>
            </tr>

            <!-- Items -->
            <tr>
              <td style="padding:14px 28px 0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};">
                  <tr><td style="padding:16px 0 4px 0;">
                    <span style="font-size:15px;font-weight:700;color:${C.fg};">${escapeHtml(t.itemsHeading)}</span>
                    <span style="font-size:12px;color:${C.mutedFg};"> &nbsp;·&nbsp; ${escapeHtml(t.orderNumberLabel)}: ${escapeHtml(order.orderNumber)}</span>
                  </td></tr>
                </table>
                <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${itemRows}</table>
              </td>
            </tr>

            <!-- Totals -->
            <tr>
              <td style="padding:8px 28px 24px 28px;">
                <table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};padding-top:8px;">
                  <tr><td colspan="2" style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
                  ${totalRow(t.subtotalLabel, fmt(order.subtotalFils))}
                  ${totalRow(t.shippingLabel, order.shippingFils === 0 ? t.freeShipping : fmt(order.shippingFils))}
                  ${discountFils > 0 ? totalRow(t.discountLabel, `- ${fmt(discountFils)}`, { accent: true }) : ""}
                  ${totalRow(t.totalLabel, fmt(order.totalFils), { strong: true })}
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 28px;background:${C.secondary};border-top:1px solid ${C.border};">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:${C.mutedFg};">${escapeHtml(t.help)}</p>
                <p style="margin:0;font-size:12px;color:${C.mutedFg};">${escapeHtml(t.signature)}</p>
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
  const dateRange = deliveryDateRange(locale, order.placedAt, minDays, maxDays);
  const discountFils = order.discountFils ?? 0;

  const lines: string[] = [
    BRAND,
    t.confirmedTag,
    "",
    t.greeting(order.customerName),
    t.intro,
    "",
  ];

  if (order.shipTo) {
    lines.push(
      `${t.shipToLabel}:`,
      order.shipTo.name,
      ...order.shipTo.lines,
      "",
    );
  }

  lines.push(
    `${t.deliveryLabel}: ${t.businessDays(minDays, maxDays)}${dateRange ? ` (${dateRange})` : ""}`,
    "",
    `${t.itemsHeading} — ${t.orderNumberLabel}: ${order.orderNumber}`,
  );

  for (const item of order.items) {
    const label = item.variantLabel
      ? `${item.productName} — ${item.variantLabel}`
      : item.productName;
    lines.push(
      `- ${label} (${t.qtyLabel} × ${item.quantity}) — ${fmt(item.unitPriceFils * item.quantity)}`,
    );
  }

  lines.push(
    "",
    `${t.subtotalLabel}: ${fmt(order.subtotalFils)}`,
    `${t.shippingLabel}: ${order.shippingFils === 0 ? t.freeShipping : fmt(order.shippingFils)}`,
  );
  if (discountFils > 0) {
    lines.push(`${t.discountLabel}: - ${fmt(discountFils)}`);
  }
  lines.push(`${t.totalLabel}: ${fmt(order.totalFils)}`);

  if (order.orderUrl) {
    lines.push("", `${t.viewOrder}: ${order.orderUrl}`);
  }

  lines.push("", t.help, "", t.signature);
  return lines.join("\n");
}
