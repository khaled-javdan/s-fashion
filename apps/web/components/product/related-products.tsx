import { ProductCard } from "@/components/product/product-card"
import type { Locale } from "@/lib/locale"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

type Props = {
  title: string
  products: ProductWithRelations[]
  locale: Locale
}

/** A titled grid of product cards ("You may also like"). Renders nothing when empty. */
export function RelatedProducts({ title, products, locale }: Props) {
  if (products.length === 0) return null

  return (
    <section className="mt-16">
      <h2 className="font-heading mb-6 text-2xl tracking-wide sm:text-3xl">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  )
}
