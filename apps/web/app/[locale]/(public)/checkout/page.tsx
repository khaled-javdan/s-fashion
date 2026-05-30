import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { CheckoutForm } from "@/app/[locale]/(public)/checkout/checkout-form"
import { getCurrencyContext } from "@/lib/currency-context.server"
import { LOCALES } from "@/lib/locale"
import { getSetting } from "@/lib/repos/settings.repo"
import { parseShippingConfig } from "@/lib/shipping-config"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "checkout" })
  return { title: t("title") }
}

/**
 * Single-page checkout. Server Component that reads shipping settings (so the
 * order summary and progress bar can compute display totals consistently with
 * the server-side pricing) and renders the client checkout form.
 */
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations("checkout")

  const [shippingConfig, currencyCtx] = await Promise.all([
    getSetting("shipping.countries").then(parseShippingConfig),
    getCurrencyContext(),
  ])

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
        {t("title")}
      </h1>
      <CheckoutForm
        shippingConfig={shippingConfig}
        defaultCountry={currencyCtx.country}
        enabledCountries={currencyCtx.enabledCountries}
      />
    </section>
  )
}
