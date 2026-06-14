import Link from "next/link"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ChevronDown, Layers, Shirt, SlidersHorizontal } from "lucide-react"

import { Size } from "@workspace/db"
import { cn } from "@workspace/ui/lib/utils"

import { CatalogSearch } from "@/components/product/catalog-search"
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
import type { ProductWithRelations } from "@/lib/repos/products.shared"
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
  const q = firstParam(sp.q)?.trim() || undefined
  const sortParam = firstParam(sp.sort)
  // A search query defaults to relevance ranking unless the shopper picks a
  // different sort; without a query we keep newest-first as before.
  const sort: ProductSort = PRODUCT_SORTS.includes(sortParam as ProductSort)
    ? (sortParam as ProductSort)
    : q
      ? "relevance"
      : "newest"

  const view = firstParam(sp.view) === "styles" ? "styles" : "products"
  const isStylesView = view === "styles"

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
      q,
      sort,
    }),
  ])
  const grid = parseGridConfig(gridRaw)
  const ratings = await getRatingSummaries(products.map((p) => p.id))

  type StyleEntry = {
    product: ProductWithRelations
    preselectedColor: string | undefined
    colorLabel: string | undefined
    key: string
  }

  // "All products" (default) = one card per color variant (every individual style visible).
  // "All styles" (?view=styles) = one card per product with color swatch carousel.
  const entries: StyleEntry[] = !isStylesView
    ? products.flatMap((product): StyleEntry[] => {
        const seen = new Map<string, { nameEn: string | null; nameAr: string | null }>()
        for (const v of product.variants) {
          if (v.colorHex && !seen.has(v.colorHex)) {
            seen.set(v.colorHex, { nameEn: v.colorNameEn, nameAr: v.colorNameAr })
          }
        }
        if (seen.size === 0) {
          return [{ product, preselectedColor: undefined, colorLabel: undefined, key: product.id }]
        }
        return [...seen.entries()].map(([hex, names]) => ({
          product,
          preselectedColor: hex,
          colorLabel:
            typedLocale === "ar"
              ? (names.nameAr ?? names.nameEn ?? undefined)
              : (names.nameEn ?? names.nameAr ?? undefined),
          key: `${product.id}-${hex}`,
        }))
      })
    : products.map((p) => ({
        product: p,
        preselectedColor: undefined,
        colorLabel: undefined,
        key: p.id,
      }))

  const buildViewHref = (v: "products" | "styles") => {
    const p = new URLSearchParams()
    if (colors.length) p.set("color", colors.join(","))
    if (sizes.length) p.set("size", sizes.join(","))
    if (minAed != null) p.set("min", String(minAed))
    if (maxAed != null) p.set("max", String(maxAed))
    if (inStockOnly) p.set("in_stock", "1")
    if (onSaleOnly) p.set("on_sale", "1")
    if (sort !== "newest" && sort !== "relevance") p.set("sort", sort)
    if (q) p.set("q", q)
    if (v === "styles") p.set("view", "styles")
    const qs = p.toString()
    return qs ? `?${qs}` : "?"
  }

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
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl tracking-wide sm:text-4xl">
            {q ? t("search_title", { query: q }) : t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {q
              ? t("search_results", { count: total, query: q })
              : !isStylesView
                ? t("count", { count: entries.length })
                : t("count_styles", { count: total })}
          </p>
        </div>
        <div className="max-w-md flex-1">
          <CatalogSearch initialQuery={q ?? ""} />
        </div>
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
          {entries.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">
              {q ? t("search_empty", { query: q }) : t("empty")}
            </p>
          ) : (
            <ProductGrid
              config={grid}
              desktopToggle
              storageScope="products"
              viewToggle={
                <div className="flex items-center gap-1 rounded-md border p-0.5 text-sm">
                  <Link
                    href={buildViewHref("products")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition",
                      !isStylesView
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Shirt className="size-3.5" />
                    {t("view_products")}
                  </Link>
                  <Link
                    href={buildViewHref("styles")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition",
                      isStylesView
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Layers className="size-3.5" />
                    {t("view_styles")}
                  </Link>
                </div>
              }
            >
              {entries.map(({ product, preselectedColor, colorLabel, key }, index) => (
                <li key={key}>
                  <ProductCard
                    product={product}
                    locale={typedLocale}
                    priority={index < 4}
                    rating={ratings.get(product.id)}
                    preselectedColor={preselectedColor}
                    colorLabel={colorLabel}
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
