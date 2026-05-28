import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductCard } from "@/components/product/product-card"
import { LOCALES, type Locale } from "@/lib/locale"
import { listActiveProducts } from "@/lib/repos/products.repo"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "home" })
  return { title: t("title") }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const typedLocale: Locale = locale
  const t = await getTranslations("home")
  const products = await listActiveProducts({ take: 12 })

  return (
    <div className="flex flex-col gap-12 py-10 sm:py-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-6 text-center">
        <h1 className="font-heading text-foreground text-4xl tracking-wide sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-base">{t("hero_tagline")}</p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 className="font-heading mb-6 text-2xl tracking-wide sm:text-3xl">
          {t("shop_heading")}
        </h2>
        {products.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">
            {t("empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} locale={typedLocale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
