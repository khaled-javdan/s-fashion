import { htmlToPlainText } from "@/components/product/rich-text"
import { fabricMaterialLabel } from "@/lib/fabric"
import type { Locale } from "@/lib/locale"
import { filsToAed } from "@/lib/money"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

type Props = {
  product: ProductWithRelations
  locale: Locale
  /** Canonical absolute URL of this PDP. */
  url: string
}

/**
 * Server Component emitting schema.org Product JSON-LD. Availability is derived
 * from aggregate variant stock; price is the (decimal) AED string of `priceFils`.
 */
export function ProductJsonLd({ product, locale, url }: Props) {
  const name = locale === "ar" ? product.nameAr : product.nameEn
  const rawDescription = locale === "ar" ? product.descAr : product.descEn
  // JSON-LD must be plain text — strip the rich-text HTML markup.
  const description = rawDescription
    ? htmlToPlainText(rawDescription)
    : undefined
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    image: product.images.map((image) => image.url),
    // Fabric pieces: expose the material + piece size to search engines.
    ...(product.kind === "FABRIC" && product.fabricMaterial
      ? { material: fabricMaterialLabel(product.fabricMaterial, "en") }
      : {}),
    ...(product.kind === "FABRIC" && product.fabricLengthCm
      ? {
          size: [
            product.fabricLengthCm ? `${product.fabricLengthCm / 100} m` : null,
            product.fabricWidthCm ? `${product.fabricWidthCm} cm wide` : null,
          ]
            .filter(Boolean)
            .join(" × "),
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "AED",
      price: filsToAed(product.priceFils).toFixed(2),
      url,
      availability:
        totalStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  }

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; no user-controlled HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
