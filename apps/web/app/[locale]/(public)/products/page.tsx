import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  CatalogView,
  type SearchParams,
} from "@/components/product/catalog-view"
import { LOCALES } from "@/lib/locale"
import { listShoppableCategories } from "@/lib/repos/categories.repo"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const t = await getTranslations({ locale, namespace: "products" })
  return { title: t("title"), description: t("subtitle") }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const [sp, categories] = await Promise.all([
    searchParams,
    listShoppableCategories(),
  ])

  return <CatalogView locale={locale} sp={sp} categories={categories} />
}
