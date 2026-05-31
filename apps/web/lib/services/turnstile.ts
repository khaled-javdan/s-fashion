/**
 * Cloudflare Turnstile server-side verification.
 *
 * Protects the OTP-send action from bots / SMS-pumping (toll fraud). The
 * widget is invisible/managed for real users, so there's no captcha friction.
 *
 * Env vars (server-only):
 * - TURNSTILE_SECRET_KEY      paired with NEXT_PUBLIC_TURNSTILE_SITE_KEY (client)
 *
 * Gating: when TURNSTILE_SECRET_KEY is unset the check is skipped (returns
 * true), so local dev and not-yet-provisioned environments keep working — same
 * convention as the Twilio/Resend wrappers. Must not be imported by client
 * components.
 */

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when a Turnstile secret is configured (verification is enforced). */
export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * - Not configured → `true` (skip).
 * - Configured but no/invalid token → `false`.
 * - Configured and Cloudflare is unreachable → `true` (fail-open): the
 *   per-phone/per-IP rate limits still apply, and we'd rather not block real
 *   sales during a Cloudflare blip.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured — skip
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);

    const res = await fetch(VERIFY_URL, { method: "POST", body });
    if (!res.ok) {
      console.error("[turnstile.verify] siteverify HTTP", res.status);
      return true; // transport-level failure → fail open
    }
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile.verify]", err);
    return true; // network failure → fail open (rate limits still guard)
  }
}
