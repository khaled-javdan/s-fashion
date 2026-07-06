"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

import { ProductGrid } from "@/components/home/product-grid"
import { Price } from "@/components/currency/price"
import type { GridConfig } from "@/lib/grid-config"
import type { Locale } from "@/lib/locale"

export type ViewedProduct = {
  slug: string
  nameEn: string
  nameAr: string
  imageUrl: string | null
  priceFils: number
}

type Props = {
  /**
   * The product currently being viewed — recorded into history, then excluded
   * from the rendered list. Omit on pages with no "current" product (home,
   * cart): the row then just displays existing history without recording.
   */
  current?: ViewedProduct
  locale: Locale
  title: string
  /**
   * Admin grid config. When provided (home page), the row renders through the
   * shared `ProductGrid` so it gets the mobile column-density toggle. Omitted on
   * the PDP/cart, which keep the compact fixed grid.
   */
  config?: GridConfig
  /** Max items to display (admin-configurable on the home page). */
  limit?: number
}

const STORAGE_KEY = "sf:recently-viewed"
/** How many entries to retain in history — the ceiling for any display limit. */
const STORAGE_MAX = 48
/** Display fallback when no explicit limit is passed (PDP/cart). */
const DEFAULT_LIMIT = 12

function readStore(): ViewedProduct[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ViewedProduct[]) : []
  } catch {
    return []
  }
}

/**
 * "Recently viewed" — a localStorage-backed row of the shopper's last products.
 * Records the current product on mount, then renders the others. Renders
 * nothing until there's history (and never on the server), so there's no
 * hydration mismatch.
 */
export function RecentlyViewed({
  current,
  locale,
  title,
  config,
  limit = DEFAULT_LIMIT,
}: Props) {
  const [items, setItems] = useState<ViewedProduct[]>([])

  useEffect(() => {
    // Display-only (no current product): just show stored history.
    if (!current) {
      // localStorage is an external store read on mount — an effect is correct here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(readStore())
      return
    }
    const existing = readStore().filter((p) => p.slug !== current.slug)
    const next = [current, ...existing].slice(0, STORAGE_MAX)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore quota / privacy-mode errors — the row just won't persist
    }
    // Show everything except the product being viewed.
    setItems(next.filter((p) => p.slug !== current.slug))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.slug])

  if (items.length === 0) return null

  const cards = items.slice(0, limit).map((p) => {
    const name = locale === "ar" ? p.nameAr : p.nameEn
    return (
      <li key={p.slug}>
        <Link
          href={`/${locale}/products/${p.slug}`}
          className="group flex flex-col gap-3 text-start"
          aria-label={name}
        >
          <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-md">
            {p.imageUrl ? (
              <Image
                src={p.imageUrl}
                alt={name}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-heading text-lg leading-tight tracking-wide">
              {name}
            </h3>
            <p className="text-foreground text-sm">
              <Price fils={p.priceFils} />
            </p>
          </div>
        </Link>
      </li>
    )
  })

  return (
    <section className="mt-16">
      <h2 className="font-heading mb-6 text-2xl tracking-wide sm:text-3xl">
        {title}
      </h2>
      {config ? (
        // Home: shared grid → gains the mobile density toggle.
        <ProductGrid config={config} storageScope="recently-viewed">
          {cards}
        </ProductGrid>
      ) : (
        // PDP / cart: compact fixed grid, unchanged.
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
          {cards}
        </ul>
      )}
    </section>
  )
}
