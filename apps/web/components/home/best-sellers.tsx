import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { ProductCard } from "@/components/product/product-card"
import type { Locale } from "@/lib/locale"
import { listBestSellerProducts } from "@/lib/repos/products.repo"
import { getRatingSummaries } from "@/lib/repos/reviews.repo"

/** How many best-sellers to surface in the row. */
const BEST_SELLERS_TAKE = 8

/**
 * Home "Best sellers" section.
 *
 * Server Component. Pulls the top-selling active products (ranked by units sold,
 * topped up newest-first on a fresh store) and renders them with the shared
 * `ProductCard`, so money formatting, swatches, and stock badges all stay
 * consistent with the rest of the catalogue. Renders nothing when there are no
 * products, so the home page never shows an empty heading.
 */
export async function BestSellers({ locale }: { locale: Locale }) {
  const t = await getTranslations("home")
  const products = await listBestSellerProducts(BEST_SELLERS_TAKE)

  if (products.length === 0) return null

  const ratings = await getRatingSummaries(products.map((p) => p.id))

  return (
    <section className="border-border bg-card border-y">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
        <div className="mb-8 flex flex-col gap-1">
          <h2 className="font-heading text-2xl tracking-wide sm:text-3xl">
            {t("bestsellers.heading")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("bestsellers.subheading")}
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
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
        </ul>

        <div className="mt-10 flex justify-center sm:mt-12">
          <Button asChild variant="outline" size="lg">
            <Link href={`/${locale}/products`}>
              {t("view_all")}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
