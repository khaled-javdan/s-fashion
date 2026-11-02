import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  CatalogView,
  type SearchParams,
} from "@/components/product/catalog-view"
import { LOCALES } from "@/lib/locale"
import { getVisibleCategoryBySlug } from "@/lib/repos/categories.repo"

/**
 * Absolute site origin for the canonical URL. Mirrors the product page: the
 * deployment's public URL, falling back to the production domain.
 */
function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "https://s-fashions.com"
  return url.replace(/\/+$/, "")
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const category = await getVisibleCategoryBySlug(slug)
  if (!category) return {}

  const title = locale === "ar" ? category.nameAr : category.nameEn
  const description =
    (locale === "ar" ? category.descAr : category.descEn)?.trim().slice(0, 200) ||
    undefined

  return {
    title,
    description,
    alternates: { canonical: `${appBaseUrl()}/${locale}/collections/${slug}` },
    openGraph: { title, description, type: "website" },
  }
}

/** Storefront category page: the catalogue fixed to one visible category. */
export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const [category, sp] = await Promise.all([
    getVisibleCategoryBySlug(slug),
    searchParams,
  ])
  if (!category) notFound()

  return (
    <CatalogView locale={locale} sp={sp} category={category} categories={[]} />
  )
}
