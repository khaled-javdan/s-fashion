/**
 * Order-confirmation SMS sender.
 *
 * Sends a short bilingual confirmation to the customer's verified phone after
 * an order is placed. Kept compact on purpose: Arabic SMS bills at 70 chars
 * per segment, English at 160, so every emoji and punctuation mark counts.
 *
 * The dispatcher (`order-notifications.ts`) handles idempotency and retry —
 * this module just composes the body and hands it to `twilio.sendSms`.
 *
 * Server-only.
 */
import { formatMoney, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import type { Locale } from "@/lib/locale";
import { sendSms, type SendSmsResult } from "@/lib/services/twilio";

export interface OrderSmsPayload {
  orderNumber: string;
  customerName: string;
  totalFils: number;
  /** ISO currency code at order time. Defaults to AED. */
  currency?: string;
  /** AED→currency rate. Defaults to 1. */
  fxRate?: number;
}

export interface SendOrderSmsInput {
  /** E.164 phone number — the same one OTP-verified at checkout. */
  to: string;
  locale: Locale;
  /** Absolute order-tracking URL the customer can click. */
  trackUrl: string;
  order: OrderSmsPayload;
}

/**
 * Compose and send the confirmation. Never throws — returns the tagged result
 * from the underlying Twilio call so the dispatcher can stamp on success.
 */
export async function sendOrderConfirmationSms(
  input: SendOrderSmsInput,
): Promise<SendSmsResult> {
  const body = renderBody(input);
  return sendSms(input.to, body);
}

function renderBody({ locale, trackUrl, order }: SendOrderSmsInput): string {
  const currency: CurrencyCode = isCurrencyCode(order.currency ?? "")
    ? (order.currency as CurrencyCode)
    : "AED";
  const total = formatMoney(order.totalFils, {
    locale,
    currency,
    rate: order.fxRate ?? 1,
  });
  // Use only the first name to keep the message inside one SMS segment when
  // possible. Falls back to the full name if there's nothing to split on.
  const firstName = (order.customerName.trim().split(/\s+/u)[0] ?? "").trim();
  const greetName = firstName.length > 0 ? firstName : order.customerName;

  if (locale === "ar") {
    // ~80–110 chars in Arabic (incl. URL) → typically 2 segments. Compact.
    return `سفاشن: شكراً ${greetName}! تم تأكيد طلبك #${order.orderNumber} - ${total}. تتبع: ${trackUrl}`;
  }
  // ~110–150 chars in Latin → 1 segment for short order numbers + URL.
  return `S Fashion: Thanks ${greetName}! Order #${order.orderNumber} confirmed — ${total}. Track: ${trackUrl}`;
}
