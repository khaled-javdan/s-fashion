import Image from "next/image"
import Link from "next/link"

import type { Locale } from "@/lib/locale"
import { formatAed } from "@/lib/money"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

type Props = {
  product: ProductWithRelations
  locale: Locale
}

export function ProductCard({ product, locale }: Props) {
  const name = locale === "ar" ? product.nameAr : product.nameEn
  const primaryImage = product.images[0]
  const alt =
    (locale === "ar" ? primaryImage?.altAr : primaryImage?.altEn) ?? name

  return (
    <Link
      href={`/${locale}/products/${product.slug}`}
      className="group flex flex-col gap-3 text-start"
    >
      <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-md">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg leading-tight tracking-wide">
          {name}
        </h3>
        <p className="text-muted-foreground text-sm">
          {formatAed(product.priceFils, locale)}
        </p>
      </div>
    </Link>
  )
}
