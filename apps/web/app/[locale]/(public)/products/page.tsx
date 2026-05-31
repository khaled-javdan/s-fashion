import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { Size } from "@workspace/db"

import { ProductCard } from "@/components/product/product-card"
import { ProductFilters } from "@/components/product/product-filters"
import { ProductGrid } from "@/components/home/product-grid"
import { aedToFils, filsToAed } from "@/lib/money"
import { parseGridConfig } from "@/lib/grid-config"
import { LOCALES, type Locale } from "@/lib/locale"
import {
  getCatalogFacets,
  listProductsFiltered,
  PRODUCT_SORTS,
  type ProductSort,
} from "@/lib/repos/products.repo"
import { getRatingSummaries } from "@/lib/repos/reviews.repo"
import { getSetting } from "@/lib/repos/settings.repo"

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

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Parse a comma-separated list param into a clean string array. */
function listParam(value: string | string[] | undefined): string[] {
  const raw = firstParam(value)
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Parse a positive integer param, or `null` when absent / invalid. */
function intParam(value: string | string[] | undefined): number | null {
  const raw = firstParam(value)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

const SIZE_VALUES = new Set(Object.values(Size) as Size[])

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

  const typedLocale: Locale = locale
  const sp = await searchParams
  const t = await getTranslations("products")

  // Parse the shareable URL state.
  const colors = listParam(sp.color).map((c) => c.toLowerCase())
  const sizes = listParam(sp.size).filter((s): s is Size =>
    SIZE_VALUES.has(s as Size),
  )
  const minAed = intParam(sp.min)
  const maxAed = intParam(sp.max)
  const inStockOnly = firstParam(sp.in_stock) === "1"
  const onSaleOnly = firstParam(sp.on_sale) === "1"
  const sortParam = firstParam(sp.sort)
  const sort: ProductSort = PRODUCT_SORTS.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : "newest"

  const [facets, gridRaw, { products, total }] = await Promise.all([
    getCatalogFacets(),
    getSetting("home.grid"),
    listProductsFiltered({
      colors,
      sizes,
      minFils: minAed != null ? aedToFils(minAed) : undefined,
      maxFils: maxAed != null ? aedToFils(maxAed) : undefined,
      inStockOnly,
      onSaleOnly,
      sort,
    }),
  ])
  const grid = parseGridConfig(gridRaw)
  const ratings = await getRatingSummaries(products.map((p) => p.id))

  const priceBounds = {
    min: Math.floor(filsToAed(facets.minFils)),
    max: Math.ceil(filsToAed(facets.maxFils)),
  }

  const active = {
    colors,
    sizes,
    minAed,
    maxAed,
    inStockOnly,
    onSaleOnly,
    sort,
  }

  // Count of applied filters (sort excluded) — surfaced as a badge on the
  // mobile trigger so it's obvious filters are active without expanding it.
  const activeCount =
    colors.length +
    sizes.length +
    (minAed != null || maxAed != null ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0)

  const filterPanel = (
    <ProductFilters
      locale={typedLocale}
      facets={facets}
      priceBounds={priceBounds}
      active={active}
    />
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-0">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="font-heading text-3xl tracking-wide sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("count", { count: total })}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
        {/* Mobile: collapsible filters (native, dependency-free). */}
        <details className="group lg:hidden">
          <summary className="border-border bg-card flex cursor-pointer list-none items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm font-medium shadow-sm">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {t("filters_button")}
              {activeCount > 0 ? (
                <span className="bg-foreground text-background inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
                  {activeCount}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className="text-muted-foreground size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-border mt-3 rounded-md border p-4">
            {filterPanel}
          </div>
        </details>

        {/* Desktop: sticky sidebar. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">{filterPanel}</div>
        </aside>

        <div>
          {products.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">
              {t("empty")}
            </p>
          ) : (
            <ProductGrid config={grid} desktopToggle>
              {products.map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    locale={typedLocale}
                    priority={index < 4}
                    rating={ratings.get(product.id)}
                  />
                </li>
              ))}
            </ProductGrid>
          )}
        </div>
      </div>
    </div>
  )
}
