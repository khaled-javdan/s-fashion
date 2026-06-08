/**
 * Twilio wrapper.
 *
 * Provides typed helpers for:
 *  - SMS OTP send/check via Twilio Verify v2 (`sendOtp` / `checkOtp`)
 *  - Generic transactional SMS via Twilio Messages API (`sendSms`) — used for
 *    order confirmations and other non-OTP customer messaging.
 *
 * All boundary errors are caught and returned as tagged results — these
 * functions never throw across the boundary.
 *
 * Env vars (server-only):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_VERIFY_SERVICE_SID         (required for OTP)
 *
 * For `sendSms`, configure ONE of:
 * - TWILIO_MESSAGING_SERVICE_SID      (preferred — Twilio picks the best sender)
 * - TWILIO_SMS_FROM_NUMBER            (fallback — a Twilio phone number, E.164)
 *
 * When neither SMS env var is set, `sendSms` returns `{ ok: false }` with a
 * "not configured" error and callers (the order dispatcher) skip gracefully.
 *
 * This module reads server-only env vars and must never be imported into a
 * client component. Keep imports limited to Server Actions, route handlers,
 * and other server modules.
 */
import twilio, { type Twilio } from "twilio";

export type VerificationStatus = "approved" | "pending" | "failed";

export type SendOtpResult =
  | { ok: true }
  | { ok: false; error: string };

export type CheckOtpResult =
  | { ok: true; status: VerificationStatus }
  | { ok: false; status: VerificationStatus; error: string };

export type SendSmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

let cachedClient: Twilio | null = null;

function getClient(): Twilio {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error(
      "Twilio is not configured: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing.",
    );
  }
  cachedClient = twilio(sid, token);
  return cachedClient;
}

function getVerifyServiceSid(): string {
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!verifySid) {
    throw new Error(
      "Twilio is not configured: TWILIO_VERIFY_SERVICE_SID missing.",
    );
  }
  return verifySid;
}

/**
 * Send a WhatsApp OTP to the given phone number (E.164, e.g. +971501234567).
 * Returns ok on success; never throws.
 *
 * WhatsApp (not SMS) is used deliberately: UAE carriers block SMS from
 * unregistered alphanumeric Sender IDs, whereas WhatsApp delivers internationally
 * without that registration. The Twilio Verify service must have the WhatsApp
 * channel enabled and the account must be out of trial.
 */
export async function sendOtp(phoneE164: string): Promise<SendOtpResult> {
  try {
    const client = getClient();
    const verifySid = getVerifyServiceSid();
    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: phoneE164, channel: "whatsapp" });
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send OTP.";
    console.error("[twilio.sendOtp]", message);
    return { ok: false, error: message };
  }
}

/**
 * Check an OTP code against the given phone number. Returns the verification
 * status. `ok` is true only when status === "approved".
 */
export async function checkOtp(
  phoneE164: string,
  code: string,
): Promise<CheckOtpResult> {
  try {
    const client = getClient();
    const verifySid = getVerifyServiceSid();
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: phoneE164, code });

    const raw = String(check.status ?? "failed").toLowerCase();
    const status: VerificationStatus =
      raw === "approved" || raw === "pending" ? raw : "failed";

    if (status === "approved") return { ok: true, status };
    return { ok: false, status, error: `Verification ${status}.` };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check OTP.";
    console.error("[twilio.checkOtp]", message);
    return { ok: false, status: "failed", error: message };
  }
}

/**
 * Send a one-off transactional SMS via Twilio's Messages API.
 *
 * Returns the message SID on success. Prefers a Messaging Service SID over a
 * fixed from-number — Messaging Services let Twilio route via the best sender
 * for the destination country (alphanumeric sender ID for GCC, long codes
 * elsewhere) without the caller picking. Falls back to a from-number when no
 * service SID is configured. When neither is set, returns a tagged error
 * instead of throwing — the order dispatcher treats that as "SMS disabled" and
 * the retry cron will keep trying once the env var lands.
 *
 * Never throws.
 */
export async function sendSms(
  toE164: string,
  body: string,
): Promise<SendSmsResult> {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_SMS_FROM_NUMBER;
  if (!messagingServiceSid && !fromNumber) {
    return {
      ok: false,
      error:
        "Twilio SMS not configured: set TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM_NUMBER.",
    };
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      to: toE164,
      body,
      ...(messagingServiceSid
        ? { messagingServiceSid }
        : { from: fromNumber as string }),
    });
    return { ok: true, sid: message.sid };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send SMS.";
    console.error("[twilio.sendSms]", message);
    return { ok: false, error: message };
  }
}
