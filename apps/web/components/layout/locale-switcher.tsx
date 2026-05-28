"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@workspace/ui/components/button"

import { LOCALES, type Locale } from "@/lib/locale"

/**
 * Locale switcher.
 *
 * Renders a link that swaps the leading locale segment in the current
 * pathname while preserving everything after it (route, query is dropped at
 * this stage because we want a hard navigation that re-resolves the segment
 * tree under the new locale).
 *
 * Visually it's a compact button so it fits in the header on mobile.
 */
export function LocaleSwitcher() {
  const t = useTranslations("header")
  const current = useLocale() as Locale
  const pathname = usePathname()

  const other: Locale = current === "ar" ? "en" : "ar"

  // Replace the first `/{locale}` segment in the pathname with the other
  // locale. If somehow the pathname doesn't start with a known locale (it
  // should, because of middleware), fall back to the root of the other locale.
  const otherHref = buildSwitchHref(pathname, other)

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      // Tightly spaced toggle so it works on a 375px viewport.
      className="px-3"
      aria-label={t("language")}
    >
      <Link href={otherHref} hrefLang={other} prefetch={false}>
        {t("language")}
      </Link>
    </Button>
  )
}

function buildSwitchHref(pathname: string, target: Locale): string {
  if (!pathname || pathname === "/") return `/${target}`
  const segments = pathname.split("/")
  // `pathname` starts with `/`, so segments[0] is "" and segments[1] is the locale.
  if (segments.length > 1 && (LOCALES as readonly string[]).includes(segments[1] ?? "")) {
    segments[1] = target
    return segments.join("/") || `/${target}`
  }
  return `/${target}${pathname}`
}
