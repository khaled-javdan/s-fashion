/**
 * Twilio Verify wrapper.
 *
 * Provides typed helpers for sending and checking SMS OTP codes via the
 * Twilio Verify v2 API. All boundary errors are caught and returned as
 * tagged results — these functions never throw across the boundary.
 *
 * Env vars (server-only):
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_VERIFY_SERVICE_SID
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
 * Send an SMS OTP to the given phone number (E.164, e.g. +971501234567).
 * Returns ok on success; never throws.
 */
export async function sendOtp(phoneE164: string): Promise<SendOtpResult> {
  try {
    const client = getClient();
    const verifySid = getVerifyServiceSid();
    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: phoneE164, channel: "sms" });
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
