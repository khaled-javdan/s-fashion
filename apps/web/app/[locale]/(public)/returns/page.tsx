import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import {
  ContentPage,
  ContentSections,
  type ContentSectionData,
} from "@/components/content/content-page"
import { LOCALES, type Locale } from "@/lib/locale"
import { getSetting } from "@/lib/repos/settings.repo"

/** Returns window applied when the `returns.window_days` setting is unset. */
const DEFAULT_RETURNS_WINDOW_DAYS = 14

/**
 * Interpolate the `{days}` placeholder through a section's copy. `t.raw` returns
 * the message structure verbatim (no interpolation), so we substitute manually.
 */
function injectDays(
  sections: ContentSectionData[],
  days: number,
): ContentSectionData[] {
  const sub = (s: string) => s.replaceAll("{days}", String(days))
  return sections.map((section) => ({
    ...section,
    heading: sub(section.heading),
    body: section.body?.map(sub),
    items: section.items?.map(sub),
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "returns" })
  return { title: t("title") }
}

export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  const t = await getTranslations("returns")
  const windowSetting = await getSetting("returns.window_days")
  const days =
    typeof windowSetting === "number"
      ? windowSetting
      : DEFAULT_RETURNS_WINDOW_DAYS

  const sections = injectDays(
    t.raw("sections") as ContentSectionData[],
    days,
  )

  return (
    <ContentPage title={t("title")} intro={t("intro", { days })}>
      <ContentSections sections={sections} />
    </ContentPage>
  )
}
