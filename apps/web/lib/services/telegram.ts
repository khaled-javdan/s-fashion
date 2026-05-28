/**
 * Telegram Bot wrapper.
 *
 * Posts order notifications to the team's Telegram group via the Bot API.
 * All errors are logged and returned as { ok: false }; this module never
 * throws across the boundary so the order-creation flow is not blocked
 * by a transient Telegram outage.
 *
 * Env vars (server-only):
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 *
 * Must not be imported by client components.
 */

/**
 * Local fils->AED formatter. We avoid importing `@/lib/money` here so this
 * module can build independently of Track A. When the shared helper lands,
 * `formatAedFils` can be replaced with `formatAed(fils, "en")`.
 */
function formatAedFils(fils: number): string {
  const aed = fils / 100;
  return `AED ${aed.toFixed(2)}`;
}

export type SendNotificationResult =
  | { ok: true }
  | { ok: false; error: string };

export interface OrderNotificationInput {
  /** Human-readable order number, e.g. "SF-2026-00123". */
  orderNumber: string;
  /** Customer's full name as captured at checkout. */
  customerName: string;
  /** E.164 phone, e.g. "+971501234567". */
  phone: string;
  /** Emirate enum value (e.g. "DUBAI") or display string. */
  emirate: string;
  /** Order total in integer fils. */
  totalFils: number;
  /** Number of line items (sum of quantities). */
  itemCount: number;
  /** Absolute URL to the order detail page in the admin panel. */
  adminUrl: string;
}

/**
 * Send an HTML-formatted order notification to the configured Telegram chat.
 * The message includes a clickable "Open in admin" link.
 *
 * Returns ok=false (without throwing) on any failure so callers can fan out
 * notifications without their main flow being interrupted.
 */
export async function sendOrderNotification(
  order: OrderNotificationInput,
): Promise<SendNotificationResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    const error = "Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing).";
    console.warn("[telegram.sendOrderNotification]", error);
    return { ok: false, error };
  }

  const text = buildOrderMessage(order);

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    if (!res.ok) {
      const body = await safeReadBody(res);
      const error = `Telegram API returned ${res.status}: ${body}`;
      console.error("[telegram.sendOrderNotification]", error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error sending Telegram message.";
    console.error("[telegram.sendOrderNotification]", message);
    return { ok: false, error: message };
  }
}

function buildOrderMessage(order: OrderNotificationInput): string {
  const total = formatAedFils(order.totalFils);
  return [
    `<b>New order ${escapeHtml(order.orderNumber)}</b>`,
    "",
    `<b>Customer:</b> ${escapeHtml(order.customerName)}`,
    `<b>Phone:</b> ${escapeHtml(order.phone)}`,
    `<b>Emirate:</b> ${escapeHtml(order.emirate)}`,
    `<b>Items:</b> ${order.itemCount}`,
    `<b>Total:</b> ${escapeHtml(total)}`,
    "",
    `<a href="${escapeHtml(order.adminUrl)}">Open in admin</a>`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<unreadable body>";
  }
}
