import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import type { Locale } from "@/lib/locale"

/**
 * Public footer (Round 1).
 *
 * Layout:
 *  - Brand wordmark + tagline.
 *  - Two link columns: "Shop" and "Help".
 *  - Social icons (Instagram, TikTok, Snapchat) — placeholder hrefs.
 *  - Business hours line. NOTE: hardcoded in Round 1; Track B's settings
 *    repo lands later and Round 2 wires this up.
 *  - Bottom strip: copyright + "Made with care in the UAE".
 *
 * Server Component — no interactivity.
 */
export function Footer() {
  const t = useTranslations("footer")
  const locale = useLocale() as Locale
  const year = new Date().getUTCFullYear()

  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <Link
            href={`/${locale}`}
            className="font-heading text-xl tracking-[0.35em] uppercase text-foreground"
          >
            S FASHION
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {t("tagline")}
          </p>
        </div>

        <div className="md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            {t("shop_heading")}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href={`/${locale}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("shop_all")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            {t("help_heading")}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href={`/${locale}/shipping`}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("shipping")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/returns`}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("returns")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/contact`}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("contact")}
              </Link>
            </li>
            <li>
              <Link
                href={`/${locale}/about`}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("about")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            {t("follow_us")}
          </h2>
          <ul className="mt-4 flex items-center gap-3">
            <li>
              <a
                href="#"
                aria-label={t("instagram")}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
              >
                <InstagramIcon />
              </a>
            </li>
            <li>
              <a
                href="#"
                aria-label={t("tiktok")}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
              >
                <TikTokIcon />
              </a>
            </li>
            <li>
              <a
                href="#"
                aria-label={t("snapchat")}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
              >
                <SnapchatIcon />
              </a>
            </li>
          </ul>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
              {t("business_hours_heading")}
            </h3>
            {/*
             * TODO(Track B / Round 2): read business hours from the `Setting`
             * table via `getSetting("contact.business_hours_ar"|"_en")`
             * instead of from the locale messages bundle.
             */}
            <p className="mt-2 text-sm text-muted-foreground">
              {t("business_hours")}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} S Fashion. {t("rights")}.
          </p>
          <p>{t("made_with_care")}</p>
        </div>
      </div>
    </footer>
  )
}

/* ---------- Brand icons (inline SVG — lucide-react does not ship these) ---------- */

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" ry="5" />
      <path d="M16 11.5a4 4 0 1 1-4-4 4 4 0 0 1 4 4Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M19.6 6.3a5.6 5.6 0 0 1-3.3-1V14a5.7 5.7 0 1 1-5-5.6v2.4a3.3 3.3 0 1 0 2.3 3.2V2h2.3a5.6 5.6 0 0 0 3.7 4.3Z" />
    </svg>
  )
}

function SnapchatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M12 2c3.4 0 5.5 2.4 5.5 5.7 0 .6 0 1.6-.2 2.4.4.3 1 .4 1.5.4.5 0 .9.4.7.9-.4 1.1-2 1.5-2.6 1.7-.2 0-.2.2-.1.4.2.4.6 1.1 1.3 1.8.7.6 1.8 1.1 2.7 1.3.4.1.5.6.2.9-.7.7-2.1 1-3.2 1.2-.1 0-.2.1-.2.3 0 .2 0 .5-.2.7-.1.1-.4.2-.7.2-.5 0-1.2-.3-2.1-.3-.4 0-.9.1-1.3.3-.9.5-1.7 1.3-3.2 1.3s-2.3-.8-3.2-1.3c-.4-.2-.9-.3-1.3-.3-.9 0-1.6.3-2.1.3-.3 0-.6-.1-.7-.2-.2-.2-.2-.5-.2-.7 0-.2-.1-.3-.2-.3-1.1-.2-2.5-.5-3.2-1.2-.3-.3-.2-.8.2-.9.9-.2 2-.7 2.7-1.3.7-.7 1.1-1.4 1.3-1.8 0-.2 0-.4-.1-.4-.6-.2-2.2-.6-2.6-1.7-.2-.5.2-.9.7-.9.5 0 1.1-.1 1.5-.4-.2-.8-.2-1.8-.2-2.4C6.5 4.4 8.6 2 12 2Z" />
    </svg>
  )
}
