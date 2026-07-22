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
import { formatMoney } from "@/lib/currency"
import { getCurrencyContext } from "@/lib/currency-context.server"
import { LOCALES, type Locale } from "@/lib/locale"
import { getSetting } from "@/lib/repos/settings.repo"
import { parseShippingConfig, resolveShipping } from "@/lib/shipping-config"

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
  const { country, currency, rate } = await getCurrencyContext()
  const shippingConfig = parseShippingConfig(
    await getSetting("shipping.countries"),
  )
  const {
    shippingFils,
    freeThresholdFils,
    freeShippingEnabled,
    minDays,
    maxDays,
  } = resolveShipping(shippingConfig, country, 0)

  const flat = formatMoney(shippingFils, { locale, currency, rate })
  const threshold = formatMoney(freeThresholdFils, { locale, currency, rate })

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
            {freeShippingEnabled ? (
              <p className="text-muted-foreground">
                {t("fees_free", { threshold })}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              {t("fees_delivery_window", { minDays, maxDays })}
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
