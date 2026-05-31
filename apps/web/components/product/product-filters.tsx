"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import type { Size } from "@workspace/db"
import { buttonVariants } from "@workspace/ui/components/button"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import type { Locale } from "@/lib/locale"
import type {
  CatalogFacets,
  ColorFacet,
  ProductSort,
} from "@/lib/repos/products.repo"

const SORTS: readonly ProductSort[] = [
  "newest",
  "price_asc",
  "price_desc",
  "best_selling",
]

type Props = {
  locale: Locale
  facets: CatalogFacets
  /** Price bounds in AED whole units (derived from the catalogue). */
  priceBounds: { min: number; max: number }
  /** Currently-applied filter state, parsed from the URL by the page. */
  active: {
    colors: string[]
    sizes: Size[]
    minAed: number | null
    maxAed: number | null
    inStockOnly: boolean
    onSaleOnly: boolean
    sort: ProductSort
  }
}

/**
 * URL-search-param-driven catalogue filter panel. Every control mutates the
 * shared `?` query (so filtered views are shareable) via the app router. Sort is
 * applied instantly; the rest are staged locally and committed with "Apply" so
 * a shopper can pick several facets before navigating once.
 */
export function ProductFilters({ locale, facets, priceBounds, active }: Props) {
  const t = useTranslations("products")
  const tProduct = useTranslations("product")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [colors, setColors] = useState<string[]>(active.colors)
  const [sizes, setSizes] = useState<Size[]>(active.sizes)
  const [minAed, setMinAed] = useState<string>(
    active.minAed != null ? String(active.minAed) : "",
  )
  const [maxAed, setMaxAed] = useState<string>(
    active.maxAed != null ? String(active.maxAed) : "",
  )
  const [inStock, setInStock] = useState(active.inStockOnly)
  const [onSale, setOnSale] = useState(active.onSaleOnly)

  const hasFilters =
    active.colors.length > 0 ||
    active.sizes.length > 0 ||
    active.minAed != null ||
    active.maxAed != null ||
    active.inStockOnly ||
    active.onSaleOnly

  const colorLabel = useMemo(
    () => (c: ColorFacet) =>
      (locale === "ar" ? c.nameAr : c.nameEn) ?? c.nameEn ?? c.nameAr ?? c.hex,
    [locale],
  )

  const toggleColor = (hex: string) =>
    setColors((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex],
    )
  const toggleSize = (size: Size) =>
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    )

  /** Build a query string from the staged controls, preserving sort. */
  const buildQuery = (): string => {
    const params = new URLSearchParams()
    if (colors.length > 0) params.set("color", colors.join(","))
    if (sizes.length > 0) params.set("size", sizes.join(","))
    if (minAed.trim() !== "") params.set("min", minAed.trim())
    if (maxAed.trim() !== "") params.set("max", maxAed.trim())
    if (inStock) params.set("in_stock", "1")
    if (onSale) params.set("on_sale", "1")
    if (active.sort !== "newest") params.set("sort", active.sort)
    return params.toString()
  }

  const apply = (event?: React.FormEvent) => {
    event?.preventDefault()
    const query = buildQuery()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const changeSort = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "newest") params.delete("sort")
    else params.set("sort", next)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-col gap-6"
      aria-label={t("filters_label")}
    >
      {/* Sort applies immediately. */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("sort_label")}
        </Label>
        <Select value={active.sort} onValueChange={changeSort}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sort.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {facets.colors.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("color_label")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => {
              const selected = colors.includes(c.hex)
              const label = colorLabel(c)
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => toggleColor(c.hex)}
                  aria-pressed={selected}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "relative size-8 rounded-full border transition",
                    selected
                      ? "ring-foreground ring-2 ring-offset-2"
                      : "border-border hover:ring-1 hover:ring-foreground/40",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {facets.sizes.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("size_label")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const selected = sizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  aria-pressed={selected}
                  className={cn(
                    "min-w-10 rounded-md border px-3 py-1.5 text-sm transition",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50",
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t("price_label")}
        </legend>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={priceBounds.min}
            max={priceBounds.max}
            value={minAed}
            onChange={(e) => setMinAed(e.target.value)}
            placeholder={String(priceBounds.min)}
            aria-label={t("price_min_aria")}
            className="w-24 tabular-nums"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={priceBounds.min}
            max={priceBounds.max}
            value={maxAed}
            onChange={(e) => setMaxAed(e.target.value)}
            placeholder={String(priceBounds.max)}
            aria-label={t("price_max_aria")}
            className="w-24 tabular-nums"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={inStock}
            onCheckedChange={(v) => setInStock(v === true)}
          />
          {t("in_stock_only")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={onSale}
            onCheckedChange={(v) => setOnSale(v === true)}
          />
          {tProduct("sale_badge")}
        </label>
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
        {hasFilters ? (
          <Link
            href={pathname}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
            )}
          >
            {t("clear")}
          </Link>
        ) : null}
      </div>
    </form>
  )
}
