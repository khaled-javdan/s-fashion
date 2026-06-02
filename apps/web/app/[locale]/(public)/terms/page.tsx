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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "terms" })
  return { title: t("title") }
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  const t = await getTranslations("terms")
  const sections = t.raw("sections") as ContentSectionData[]

  return (
    <ContentPage title={t("title")} intro={t("intro")}>
      <ContentSections sections={sections} />
    </ContentPage>
  )
}
