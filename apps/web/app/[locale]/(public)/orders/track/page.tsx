import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { OrderTrackForm } from "@/components/order/order-track-form"
import { LOCALES, type Locale } from "@/lib/locale"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "tracking" })
  return { title: t("title") }
}

/**
 * Customer order-tracking page. A lookup form (order number + checkout phone)
 * that, on a verified match, renders the localized order status. The order
 * number can be prefilled via `?order=SF-…` so confirmation pages and emails
 * can deep-link here.
 */
export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ order?: string }>
}) {
  const { locale: rawLocale } = await params
  if (!hasLocale(LOCALES, rawLocale)) notFound()
  const locale = rawLocale as Locale
  setRequestLocale(locale)

  const { order } = await searchParams
  const t = await getTranslations("tracking")

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-8">
        <OrderTrackForm locale={locale} defaultOrderNumber={order ?? ""} />
      </div>
    </section>
  )
}
