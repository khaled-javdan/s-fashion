/**
 * next-intl request configuration.
 *
 * Wired up via `createNextIntlPlugin("./i18n.ts")` in `next.config.ts`.
 * The plugin reads this file on every request to resolve the active locale
 * and load the matching messages bundle for Server Components.
 */

import { getRequestConfig } from "next-intl/server"
import { hasLocale } from "next-intl"

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale"

export const routing = {
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
} as const

export default getRequestConfig(async ({ requestLocale }) => {
  // The `[locale]` segment effectively acts like a catch-all, so callers may
  // hand us anything. Narrow it to a supported locale or fall back to the
  // default.
  const requested = await requestLocale
  const locale: Locale = hasLocale(LOCALES, requested)
    ? requested
    : DEFAULT_LOCALE

  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
    timeZone: "Asia/Dubai",
  }
})
