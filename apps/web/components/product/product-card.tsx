import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import {
  ProductCardMedia,
  type CardSlide,
  type CardSwatch,
} from "@/components/product/product-card-media"
import { StarRating } from "@/components/reviews/star-rating"
import { Money } from "@/components/currency/money"
import { getCurrencyContext } from "@/lib/currency-context.server"
import type { Locale } from "@/lib/locale"
import type { ProductWithRelations } from "@/lib/repos/products.repo"

/** At or below this aggregate stock we nudge urgency ("Only N left"). */
const LOW_STOCK_THRESHOLD = 5

const CARD_SIZES = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 100vw"

type Props = {
  product: ProductWithRelations
  locale: Locale
  /** Mark the image as `priority` for above-the-fold LCP (first few cards). */
  priority?: boolean
  /** Aggregate rating; omit (or count 0) to hide the stars. */
  rating?: { average: number; count: number }
}

export async function ProductCard({
  product,
  locale,
  priority = false,
  rating,
}: Props) {
  const t = await getTranslations("product")
  const { currency, rate } = await getCurrencyContext()
  const name = locale === "ar" ? product.nameAr : product.nameEn
  const href = `/${locale}/products/${product.slug}`

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)
  const outOfStock = totalStock <= 0
  const lowStock = !outOfStock && totalStock <= LOW_STOCK_THRESHOLD

  const onSale =
    product.compareAtFils != null && product.compareAtFils > product.priceFils
  const percentOff = onSale
    ? Math.round(
        (1 - product.priceFils / (product.compareAtFils as number)) * 100,
      )
    : 0
  const numberFormat = new Intl.NumberFormat(
    locale === "ar" ? "ar-AE" : "en-AE",
  )

  const altOf = (img: ProductWithRelations["images"][number]): string =>
    (locale === "ar" ? img.altAr : img.altEn) ?? name

  // Order of colors: variant colors first (so swatches mirror the variant
  // list), then any extra color present only on images.
  const colorOrder: string[] = []
  for (const v of product.variants) {
    if (v.colorHex && !colorOrder.includes(v.colorHex)) {
      colorOrder.push(v.colorHex)
    }
  }
  for (const img of product.images) {
    if (img.colorHex && !colorOrder.includes(img.colorHex)) {
      colorOrder.push(img.colorHex)
    }
  }
  const labelFor = (hex: string): string => {
    const v = product.variants.find((x) => x.colorHex === hex)
    return (
      (locale === "ar" ? v?.colorNameAr : v?.colorNameEn) ??
      v?.colorNameEn ??
      v?.colorNameAr ??
      ""
    )
  }

  // Build the slide list: untagged photos first, then each color's photos.
  // Swatches jump to a color's first slide (index -1 = no dedicated photo).
  const slides: CardSlide[] = []
  for (const img of product.images.filter((i) => !i.colorHex)) {
    slides.push({ url: img.url, alt: altOf(img) })
  }
  const swatches: CardSwatch[] = []
  for (const hex of colorOrder) {
    const imgs = product.images.filter((i) => i.colorHex === hex)
    if (imgs.length > 0) {
      swatches.push({ hex, label: labelFor(hex), index: slides.length })
      for (const img of imgs) slides.push({ url: img.url, alt: altOf(img) })
    } else {
      swatches.push({ hex, label: labelFor(hex), index: -1 })
    }
  }
  // Safety net: if nothing landed in slides but the product has images, show them.
  if (slides.length === 0 && product.images.length > 0) {
    for (const img of product.images) {
      slides.push({ url: img.url, alt: altOf(img) })
    }
  }

  const overlay = (
    <>
      <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
        {onSale ? (
          <Badge
            variant="destructive"
            className="rounded-sm px-2 py-0.5 text-[11px]"
          >
            {percentOff > 0
              ? t("discount_badge", { percent: numberFormat.format(percentOff) })
              : t("sale_badge")}
          </Badge>
        ) : null}
        {product.isFinalSale ? (
          <Badge className="bg-foreground text-background rounded-sm px-2 py-0.5 text-[11px]">
            {t("final_sale")}
          </Badge>
        ) : null}
      </div>

      {outOfStock ? (
        <span className="bg-background/90 text-foreground absolute inset-x-2 bottom-2 rounded-sm px-2 py-1 text-center text-xs font-medium">
          {t("out_of_stock")}
        </span>
      ) : lowStock ? (
        <span className="bg-background/90 text-foreground absolute bottom-2 start-2 rounded-sm px-2 py-0.5 text-[11px] font-medium shadow-sm">
          {t("low_stock_count", { count: totalStock })}
        </span>
      ) : null}
    </>
  )

  return (
    <div className="group flex flex-col gap-3 text-start">
      <ProductCardMedia
        href={href}
        slides={slides}
        swatches={swatches}
        sizes={CARD_SIZES}
        priority={priority}
        dimmed={outOfStock}
        overlay={overlay}
      />

      <Link href={href} className="flex flex-col gap-1.5" aria-label={name}>
        <h3 className="font-heading text-lg leading-tight tracking-wide">
          {name}
        </h3>

        {rating && rating.count > 0 ? (
          <StarRating value={rating.average} count={rating.count} size="sm" />
        ) : null}

        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "text-sm",
              onSale ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            <Money fils={product.priceFils} locale={locale} currency={currency} rate={rate} />
          </p>
          {onSale ? (
            <p className="text-muted-foreground/60 text-xs">
              <Money fils={product.compareAtFils as number} locale={locale} currency={currency} rate={rate} strikethrough />
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  )
}
