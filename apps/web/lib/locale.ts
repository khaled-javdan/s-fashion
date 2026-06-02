/**
 * Locale primitives shared across the app.
 *
 * The Arabic locale is the default and the marketing/checkout surface is
 * Arabic-first. The admin panel now also lives under `/[locale]/admin/...`
 * and respects the active locale (RTL when ar, LTR when en).
 */

export type Locale = "ar" | "en"

export const LOCALES = ["ar", "en"] as const satisfies readonly Locale[]

export const DEFAULT_LOCALE: Locale = "ar"

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * The text direction associated with a locale. Used to set `<html dir>` and
 * for any code that needs to branch on writing direction.
 */
export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}
