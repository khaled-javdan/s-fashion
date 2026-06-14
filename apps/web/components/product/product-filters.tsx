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

// ─── Color-family grouping ────────────────────────────────────────────────────

// Keyword-based classification — checked against the admin-entered nameEn first.
// Order matters: first match wins, so more specific families come before broader ones.
const FAMILY_KEYWORDS: [string, string[]][] = [
  ["black",  ["black", "ebony", "jet", "onyx", "noir"]],
  ["gray",   ["gray", "grey", "silver", "charcoal", "ash", "slate", "pewter", "graphite"]],
  ["white",  ["white", "ivory", "snow", "chalk", "pearl", "off-white", "off white"]],
  ["beige",  ["beige", "nude", "sand", "camel", "oatmeal", "linen", "ecru", "champagne", "taupe", "cream", "khaki"]],
  ["brown",  ["brown", "chocolate", "coffee", "caramel", "tan", "walnut", "chestnut", "mahogany", "mocha", "sienna", "toffee", "bronze", "copper", "rust"]],
  ["red",    ["red", "crimson", "scarlet", "burgundy", "maroon", "ruby", "wine", "cherry", "garnet"]],
  ["pink",   ["pink", "magenta", "fuchsia", "blush", "salmon", "rose", "coral", "flamingo", "peach"]],
  ["orange", ["orange", "amber", "terracotta", "apricot", "mango", "pumpkin"]],
  ["yellow", ["yellow", "gold", "mustard", "lemon", "butter", "saffron", "golden"]],
  ["green",  ["green", "olive", "mint", "sage", "emerald", "lime", "army", "forest", "hunter", "jade", "pistachio", "moss"]],
  ["blue",   ["blue", "navy", "cobalt", "teal", "turquoise", "cyan", "aqua", "azure", "denim", "indigo", "royal", "sky"]],
  ["purple", ["purple", "violet", "lavender", "lilac", "plum", "mauve", "grape", "aubergine", "eggplant"]],
]

function getFamilyIdByName(name: string): string | null {
  const lower = name.toLowerCase()
  for (const [familyId, keywords] of FAMILY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return familyId
  }
  return null
}

function getFamilyId(color: ColorFacet): string {
  // Name-based matching is more reliable than HSL math for fashion color names.
  if (color.nameEn) {
    const fromName = getFamilyIdByName(color.nameEn)
    if (fromName) return fromName
  }
  // HSL fallback for unnamed colors (rare).
  const h = color.hex.startsWith("#") ? color.hex.slice(1) : color.hex
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lit = (max + min) / 2
  if (max === min) return lit > 0.5 ? "white" : "black"
  const d = max - min
  const sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue = 0
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6
  const H = hue * 360
  const S = sat * 100
  const L = lit * 100
  if (L >= 90) return "white"
  if (L <= 12) return "black"
  if (S <= 12) return "gray"
  if (H >= 15 && H < 55 && L >= 60 && S <= 50) return "beige"
  if (H >= 10 && H < 50 && L < 60 && S < 70) return "brown"
  if (H < 15 || H >= 345) return "red"
  if (H >= 15 && H < 50) return "orange"
  if (H >= 50 && H < 75) return "yellow"
  if (H >= 75 && H < 165) return "green"
  if (H >= 165 && H < 255) return "blue"
  if (H >= 255 && H < 315) return "purple"
  return "pink"
}

type ColorFamily = {
  id: string
  nameEn: string
  nameAr: string
  /** Representative hex shown as the parent swatch. */
  hex: string
  children: ColorFacet[]
}

const FAMILY_META: Record<
  string,
  { nameEn: string; nameAr: string; hex: string; order: number }
> = {
  black:  { nameEn: "Black",  nameAr: "أسود",    hex: "#1A1A1A", order: 0 },
  gray:   { nameEn: "Gray",   nameAr: "رمادي",   hex: "#9E9E9E", order: 1 },
  white:  { nameEn: "White",  nameAr: "أبيض",    hex: "#F0F0F0", order: 2 },
  beige:  { nameEn: "Beige",  nameAr: "بيج",     hex: "#D2B48C", order: 3 },
  brown:  { nameEn: "Brown",  nameAr: "بني",     hex: "#795548", order: 4 },
  red:    { nameEn: "Red",    nameAr: "أحمر",    hex: "#E53935", order: 5 },
  pink:   { nameEn: "Pink",   nameAr: "وردي",    hex: "#E91E8C", order: 6 },
  orange: { nameEn: "Orange", nameAr: "برتقالي", hex: "#F57C00", order: 7 },
  yellow: { nameEn: "Yellow", nameAr: "أصفر",    hex: "#FDD835", order: 8 },
  green:  { nameEn: "Green",  nameAr: "أخضر",    hex: "#43A047", order: 9 },
  blue:   { nameEn: "Blue",   nameAr: "أزرق",    hex: "#1E88E5", order: 10 },
  purple: { nameEn: "Purple", nameAr: "بنفسجي",  hex: "#8E24AA", order: 11 },
}

function buildColorFamilies(colors: ColorFacet[]): ColorFamily[] {
  const map = new Map<string, ColorFacet[]>()
  for (const c of colors) {
    const id = getFamilyId(c)
    const list = map.get(id)
    if (list) list.push(c)
    else map.set(id, [c])
  }
  return [...map.entries()]
    .map(([id, children]) => {
      const meta = FAMILY_META[id] ?? {
        nameEn: id,
        nameAr: id,
        hex: children[0]?.hex ?? id,
        order: 99,
      }
      return { id, nameEn: meta.nameEn, nameAr: meta.nameAr, hex: meta.hex, children }
    })
    .sort((a, b) => (FAMILY_META[a.id]?.order ?? 99) - (FAMILY_META[b.id]?.order ?? 99))
}

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
  const colorFamilies = useMemo(() => buildColorFamilies(facets.colors), [facets.colors])
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

  const familyAnySelected = (f: ColorFamily) =>
    f.children.some((c) => colors.includes(c.hex))

  const toggleFamilyAll = (f: ColorFamily) => {
    const familyAllSelected = f.children.every((c) => colors.includes(c.hex))
    if (familyAllSelected) {
      setColors((prev) => prev.filter((h) => !f.children.some((c) => c.hex === h)))
    } else {
      setColors((prev) => {
        const s = new Set(prev)
        f.children.forEach((c) => s.add(c.hex))
        return [...s]
      })
    }
  }

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

      {colorFamilies.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("color_label")}
          </legend>

          <div className="flex flex-wrap gap-2">
            {colorFamilies.map((family) => {
              const anySelected = familyAnySelected(family)
              const label = locale === "ar" ? family.nameAr : family.nameEn
              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => toggleFamilyAll(family)}
                  aria-pressed={anySelected}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "relative size-8 rounded-full border-2 transition",
                    anySelected
                      ? "ring-foreground ring-2 ring-offset-2"
                      : "border-border hover:ring-1 hover:ring-foreground/40",
                  )}
                  style={{ backgroundColor: family.hex }}
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
