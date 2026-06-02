import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { ProductGrid } from "@/components/home/product-grid"
import { ProductCard } from "@/components/product/product-card"
import type { GridConfig } from "@/lib/grid-config"
import type { Locale } from "@/lib/locale"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

/**
 * A generic home product row — the rendering side of an admin-created "product"
 * block. Shows an optional title, the products in the shared `ProductGrid` (so it
 * inherits the mobile density toggle + admin columns), and a "See all" button.
 *
 * Renders nothing when the row has no products, so an empty filter never leaves a
 * dangling heading on the home page.
 */
export function ProductRow({
  title,
  products,
  ratings,
  locale,
  config,
  ctaHref,
  viewAllLabel,
  scope,
}: {
  title: string
  products: ProductWithRelations[]
  /** product id → aggregate rating (for the card stars). */
  ratings: Map<string, { average: number; count: number }>
  locale: Locale
  config: GridConfig
  /** Resolved, locale-prefixed "See all" href. */
  ctaHref: string
  viewAllLabel: string
  /** Density-toggle storage scope (unique per row). */
  scope: string
}) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      {title ? (
        <div className="mb-8 flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
            {title}
          </h2>
        </div>
      ) : null}

      <ProductGrid config={config} storageScope={scope}>
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              locale={locale}
              priority={index < 4}
              rating={ratings.get(product.id)}
            />
          </li>
        ))}
      </ProductGrid>

      <div className="mt-10 flex justify-center sm:mt-12">
        <Button asChild variant="outline" size="lg">
          <Link href={ctaHref}>
            {viewAllLabel}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  )
}
