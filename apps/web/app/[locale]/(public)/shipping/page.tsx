import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PackageSearch, Truck } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import {
  ContentPage,
  ContentSections,
  type ContentSectionData,
} from "@/components/content/content-page"
import { LOCALES, type Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"
import { getSetting } from "@/lib/repos/settings.repo"

/** Fallbacks mirror the seeded shipping settings (5 AED flat, 600 AED free). */
const DEFAULT_FLAT_FILS = 500
const DEFAULT_FREE_THRESHOLD_FILS = 60_000

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "shipping" })
  return { title: t("title") }
}

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  const t = await getTranslations("shipping")
  const [flatFils, freeThresholdFils] = await Promise.all([
    getSetting("shipping.flat_fils"),
    getSetting("shipping.free_threshold_fils"),
  ])

  const flat = formatAed(flatFils ?? DEFAULT_FLAT_FILS, locale)
  const threshold = formatAed(
    freeThresholdFils ?? DEFAULT_FREE_THRESHOLD_FILS,
    locale,
  )

  const sections = t.raw("sections") as ContentSectionData[]

  return (
    <ContentPage title={t("title")} intro={t("intro")}>
      {/* Live fee summary — tracks whatever the admin sets in settings. */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <Truck
            className="mt-0.5 size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("fees_heading")}</p>
            <p className="text-muted-foreground">{t("fees_flat", { flat })}</p>
            <p className="text-muted-foreground">
              {t("fees_free", { threshold })}
            </p>
          </div>
        </div>
      </section>

      <ContentSections sections={sections} />

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <PackageSearch
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">{t("track_blurb")}</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/${locale}/orders/track`}>{t("track_cta")}</Link>
        </Button>
      </section>
    </ContentPage>
  )
}
