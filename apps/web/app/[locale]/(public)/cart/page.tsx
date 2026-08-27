import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { CartPageContents } from "@/components/cart/cart-page-contents"
import { CartRestore } from "@/components/cart/cart-restore"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { LOCALES, type Locale } from "@/lib/locale"
import { listRestorableCartLines } from "@/lib/repos/orders.repo"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "cart" })
  return { title: t("title") }
}

/**
 * Full cart page. Server Component shell that sets the request locale and
 * renders the client cart contents (which reads the Zustand store).
 */
export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ restore?: string }>
}) {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)
  const typedLocale: Locale = locale

  const t = await getTranslations("cart")
  const tProduct = await getTranslations("product")

  // `?restore=SF-…` comes from the abandoned-checkout email: rebuild that
  // order's still-available lines so the customer lands on a filled basket.
  const { restore } = await searchParams
  const restoreLines = restore ? await listRestorableCartLines(restore) : []

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      {restoreLines.length > 0 ? <CartRestore lines={restoreLines} /> : null}
      <h1 className="mb-8 font-heading text-2xl tracking-wide text-foreground sm:text-3xl">
        {t("title")}
      </h1>
      <CartPageContents />

      <RecentlyViewed
        locale={typedLocale}
        title={tProduct("recently_viewed")}
      />
    </section>
  )
}
