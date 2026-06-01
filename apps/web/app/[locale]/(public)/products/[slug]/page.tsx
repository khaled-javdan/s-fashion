import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { AdminEditBar } from "@/components/admin-bar/admin-edit-bar"
import { ProductColorProvider } from "@/components/product/product-color-context"
import {
  ProductGallery,
  type GalleryImage,
} from "@/components/product/product-gallery"
import { ProductJsonLd } from "@/components/product/product-jsonld"
import { ProductReviews } from "@/components/reviews/product-reviews"
import { StarRating } from "@/components/reviews/star-rating"
import { ProductTabs } from "@/components/product/product-tabs"
import { htmlToPlainText } from "@/components/product/rich-text"
import { RecentlyViewed } from "@/components/product/recently-viewed"
import { RelatedProducts } from "@/components/product/related-products"
import { SizeChartModal } from "@/components/product/size-chart-modal"
import {
  VariantPicker,
  type PickerVariant,
} from "@/components/product/variant-picker"
import { Money } from "@/components/currency/money"
import { getCurrencyContext } from "@/lib/currency-context.server"
import { LOCALES, type Locale } from "@/lib/locale"
import { DEFAULT_MAX_QTY_PER_VARIANT } from "@/lib/order-limits"
import {
  getProductBySlug,
  listSimilarProducts,
  parseProductSizeChartRows,
} from "@/lib/repos/products.repo"
import { getProductRatingSummary } from "@/lib/repos/reviews.repo"
import { getSetting } from "@/lib/repos/settings.repo"

function canonicalUrl(locale: string, slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sfashion.ae"
  return `${base.replace(/\/$/, "")}/${locale}/products/${slug}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) return {}
  const product = await getProductBySlug(slug)
  if (!product) return {}

  const name = locale === "ar" ? product.nameAr : product.nameEn
  const rawDescription = locale === "ar" ? product.descAr : product.descEn
  // Rich text is HTML — strip tags for meta/OG descriptions.
  const description = rawDescription
    ? htmlToPlainText(rawDescription, 200)
    : undefined
  const image = product.images[0]?.url

  return {
    title: name,
    description,
    alternates: { canonical: canonicalUrl(locale, slug) },
    openGraph: {
      title: name,
      description,
      images: image ? [image] : undefined,
      type: "website",
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!hasLocale(LOCALES, locale)) notFound()
  setRequestLocale(locale)

  const typedLocale: Locale = locale
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const t = await getTranslations("product")
  const { currency, rate } = await getCurrencyContext()

  const [
    maxQtySetting,
    sizeChart,
    shippingReturn,
    whatsappNumber,
    similar,
    ratingSummary,
  ] = await Promise.all([
    getSetting("order.max_qty_per_variant"),
    getSetting("size_chart.cm"),
    getSetting("product.shipping_return"),
    getSetting("contact.whatsapp_number"),
    listSimilarProducts({ excludeId: product.id, priceFils: product.priceFils }),
    getProductRatingSummary(product.id),
  ])
  const maxQtyPerVariant = maxQtySetting ?? DEFAULT_MAX_QTY_PER_VARIANT

  const name = typedLocale === "ar" ? product.nameAr : product.nameEn
  const description = typedLocale === "ar" ? product.descAr : product.descEn
  const additionalInfo =
    typedLocale === "ar" ? product.additionalInfoAr : product.additionalInfoEn
  const shippingReturnText =
    (typedLocale === "ar"
      ? shippingReturn?.contentAr
      : shippingReturn?.contentEn) ?? null
  const url = canonicalUrl(locale, slug)

  const galleryImages: GalleryImage[] = product.images.map((image) => ({
    url: image.url,
    alt: (typedLocale === "ar" ? image.altAr : image.altEn) ?? name,
    colorHex: image.colorHex,
  }))

  const pickerVariants: PickerVariant[] = product.variants.map((v) => ({
    id: v.id,
    colorHex: v.colorHex,
    colorNameAr: v.colorNameAr,
    colorNameEn: v.colorNameEn,
    size: v.size,
    stock: v.stock,
  }))

  const onSale =
    product.compareAtFils != null && product.compareAtFils > product.priceFils
  // Same percent-off calc the product card uses, only when genuinely on sale.
  const percentOff = onSale
    ? Math.round((1 - product.priceFils / (product.compareAtFils as number)) * 100)
    : 0
  const numberFormat = new Intl.NumberFormat(
    typedLocale === "ar" ? "ar-AE" : "en-AE",
  )

  // Prefer the product's own size chart override; fall back to the global
  // `size_chart.cm` setting when the product has none.
  const sizeChartRows =
    parseProductSizeChartRows(product.sizeChart) ?? sizeChart?.rows ?? []

  // Prefilled WhatsApp enquiry referencing the product name + canonical URL.
  const waText = t("share_whatsapp_text", { name, url })
  const waHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waText)}`
    : null

  return (
    <article className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-0 md:pb-8">
      <ProductJsonLd product={product} locale={typedLocale} url={url} />
      <AdminEditBar
        dashboardHref={`/${typedLocale}/admin`}
        editHref={`/${typedLocale}/admin/products/${product.id}`}
        editLabel="Edit product"
      />

      <ProductColorProvider>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <ProductGallery images={galleryImages} priority />

          {/* Details */}
          <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl tracking-wide sm:text-4xl">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-medium">
                  <Money fils={product.priceFils} locale={typedLocale} currency={currency} rate={rate} />
                </span>
                {onSale ? (
                  <span className="text-muted-foreground/70 text-lg">
                    <Money fils={product.compareAtFils!} locale={typedLocale} currency={currency} rate={rate} strikethrough />
                  </span>
                ) : null}
              </div>
              {onSale ? (
                <span className="bg-destructive text-destructive-foreground rounded-sm px-2 py-0.5 text-xs font-semibold uppercase leading-none">
                  {percentOff > 0
                    ? t("discount_badge", {
                        percent: numberFormat.format(percentOff),
                      })
                    : t("sale_badge")}
                </span>
              ) : null}
            </div>
          </div>

          <VariantPicker
            product={{
              productId: product.id,
              slug: product.slug,
              nameAr: product.nameAr,
              nameEn: product.nameEn,
              priceFils: product.priceFils,
              compareAtFils: product.compareAtFils,
              images: product.images.map((img) => ({
                url: img.url,
                colorHex: img.colorHex,
              })),
            }}
            variants={pickerVariants}
            locale={typedLocale}
            maxQtyPerVariant={maxQtyPerVariant}
          />

          {ratingSummary.count > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tabular-nums">
                {numberFormat.format(ratingSummary.average)}
              </span>
              <StarRating
                value={ratingSummary.average}
                count={ratingSummary.count}
                size="md"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <SizeChartModal rows={sizeChartRows} />
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {t("ask_on_whatsapp")}
              </a>
            ) : null}
          </div>

          </div>
        </div>

        <div className="mt-12 lg:mt-16">
          <ProductTabs
            locale={typedLocale}
            description={description ?? null}
            additionalInfo={additionalInfo ?? null}
            shippingReturn={shippingReturnText}
            sizeChartRows={sizeChartRows}
            reviews={
              <ProductReviews productId={product.id} locale={typedLocale} />
            }
          />
        </div>
      </ProductColorProvider>

      <RelatedProducts
        title={t("you_may_also_like")}
        products={similar}
        locale={typedLocale}
      />

      <RecentlyViewed
        locale={typedLocale}
        title={t("recently_viewed")}
        current={{
          slug: product.slug,
          nameEn: product.nameEn,
          nameAr: product.nameAr,
          imageUrl: product.images[0]?.url ?? null,
          priceFils: product.priceFils,
        }}
      />
    </article>
  )
}
