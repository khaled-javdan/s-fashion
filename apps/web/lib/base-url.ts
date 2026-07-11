/**
 * Absolute base URL of the app, for building links in outbound contexts
 * (notification emails/Telegram, Stripe redirect URLs). Server-only concern
 * but safe anywhere — reads only public/env config.
 */
export function appBaseUrl(): string {
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
